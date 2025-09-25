const pool = require('../config/database');
const moment = require('moment');
const { validationResult } = require('express-validator');

exports.getAvailableProjectList = async (req, res) => {
    const { userId } = req.body.userId;  // 从请求体中获取用户ID

    // 校验用户ID是否有效
    if (!userId) {
        return res.status(400).json({
            code: 400,
            message: '用户ID不能为空'
        });
    }

    try {
        // 当前时间
        // const currentTime = moment().format('YYYY-MM-DD HH:mm:ss');
        const currentTime = moment();

        // 1. 查找当前用户的已批准入场申请
        const entryQuery = `
          SELECT * 
          FROM project_entries
          WHERE user_id = ? AND entry_type = 'entry' AND status = 'approved'
        `;
        const [entryResults] = await pool.query(entryQuery, [userId]);  // 使用参数化查询

        // 2. 检查入场申请的预计离场时间是否已经超时，超时的修改为 'expired'
        const expiredEntries = [];
        for (const entry of entryResults) {
            const expectLeaveTime = moment(entry.expect_leavetime);
            if (currentTime > expectLeaveTime) {
                expiredEntries.push(entry.id); // 记录超时的入场申请
            }
        }

        // 更新超时的入场申请状态为 'expired'
        if (expiredEntries.length > 0) {
            const updateEntryStatusQuery = `
              UPDATE project_entries
              SET status = 'expired'
              WHERE id IN (?)
            `;
            await pool.query(updateEntryStatusQuery, [expiredEntries]);  // 使用参数化查询
        }

        // 3. 查找是否有与这些入场申请对应的已批准的离场申请
        const exitQuery = `
          SELECT * 
          FROM project_entries
          WHERE user_id = ? AND entry_type = 'exit' AND status = 'approved'
        `;
        const [exitResults] = await pool.query(exitQuery, [userId]);  // 使用参数化查询

        // 4. 检查离场申请的预计离场时间是否已经超时，超时则将入场申请的状态改为 'expired'
        for (const exit of exitResults) {
            const exitExpectLeaveTime = moment(exit.expect_leavetime);
            if (currentTime > exitExpectLeaveTime) {
                const entryId = exit.project_id; // 获取与之对应的入场申请的项目ID
                const locationId = exit.location_id;
                const updateEntryStatusQuery = `
                  UPDATE project_entries
                  SET status = 'expired'
                  WHERE project_id = ? AND location_id = ? AND entry_type = 'entry' AND status = 'approved'
                `;
                await pool.query(updateEntryStatusQuery, [entryId, locationId]);  // 使用参数化查询
            }
        }

        // 5. 获取符合条件的项目ID
        const validEntriesQuery = `
          SELECT DISTINCT project_id
          FROM project_entries
          WHERE user_id = ? AND entry_type = 'entry' AND status = 'approved'
        `;
        const [validEntries] = await pool.query(validEntriesQuery, [userId]);  // 使用参数化查询
        const projectIds = validEntries.map(entry => entry.project_id);

        // 6. 根据项目ID查询项目名称
        if (projectIds.length > 0) {
            const projectNamesQuery = `
          SELECT id, project_name
          FROM projects
          WHERE id IN (?)
        `;
            const [projectNames] = await pool.query(projectNamesQuery, [projectIds]);   // 使用参数化查询
            //console.log('项目名称数据:', projectNames);

            // 返回项目名称和ID的键值对
            if (Array.isArray(projectNames) && projectNames.length > 0) {
                // const projectData = projectNames.reduce((acc, project) => {
                //     console.log('处理项目:', project);
                //     // 确保项目具有 project_name 和 id 字段
                //     if (project.project_name && project.id) {
                //         acc[project.project_name] = project.id; // 将项目名称作为键，项目ID作为值
                //     }
                //     return acc;
                // }, {});

                //console.log('生成的键值对:', projectNames);  // 输出生成的项目数据

                return res.status(200).json({
                    code: 200,
                    data: projectNames
                });  // 返回键值对数据
            } else {
                return res.status(200).json({
                    code: 404,
                    message: '该项目下没有有效的打卡地'
                });
            }
        } else {
            return res.status(200).json({
                code: 404,
                message: '该用户没有有效的入场申请'
            });
        }
    } catch (err) {
        console.error('查询过程中发生错误:', err);
        return res.status(500).json({ message: '服务器错误' });
    }
};

// 用户获取某项目下的可用打卡地
exports.getProjectCheckinLocations = async (req, res) => {
    const { projectId } = req.body.projectId;  // 从请求参数中获取项目ID

    // 校验项目ID是否有效
    if (!projectId) {
        return res.status(400).json({ message: '项目ID不能为空' });
    }

    try {
        // 1. 查询项目对应的所有打卡地点
        const query = `
      SELECT id, location_name 
      FROM checkin_locations
      WHERE project_id = ? AND status = 1
    `;

        const [locations] = await pool.query(query, [projectId]);

        // 2. 如果没有打卡地点，返回空数组
        if (locations.length === 0) {
            return res.status(200).json({
                code: 404,
                message: '没有找到可用的打卡地点'
            });
        }

        // 3. 返回打卡地点名称和ID的键值对
        // const checkinLocations = results.reduce((acc, location) => {
        //     acc[location.location_name] = location.id;
        //     return acc;
        // }, {});

        return res.status(200).json({
            code: 200,
            data: locations
        });

    } catch (err) {
        console.error('查询过程中发生错误:', err);
        return res.status(500).json({
            code: 500,
            message: '服务器错误'
        });
    }
};