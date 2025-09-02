// controllers/companyController.js - 公司管理控制器
const pool = require('../config/database');
const { validationResult } = require('express-validator');

// 获取公司列表
exports.getList = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const offset = (page - 1) * pageSize;
    
    let whereClause = '';
    const params = [];
    
    if (status !== undefined) {
      whereClause = 'WHERE status = ?';
      params.push(status);
    }
    
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM companies ${whereClause}`,
      params
    );
    
    const [companies] = await pool.query(
      `SELECT * FROM companies ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    
    res.json({
      code: 200,
      message: '获取成功',
      data: {
        list: companies,
        total: countResult[0].total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error('获取公司列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取失败',
      data: null
    });
  }
};

// 创建公司
exports.create = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        code: 400,
        message: '参数验证失败',
        data: errors.array()
      });
    }

    const { company_name, valid_until } = req.body;
    
    const [result] = await pool.query(
      'INSERT INTO companies (company_name, valid_until) VALUES (?, ?)',
      [company_name, valid_until]
    );
    
    res.json({
      code: 200,
      message: '创建成功',
      data: {
        companyId: result.insertId
      }
    });
  } catch (error) {
    console.error('创建公司失败:', error);
    res.status(500).json({
      code: 500,
      message: '创建失败',
      data: null
    });
  }
};

// 更新公司
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, valid_until, status } = req.body;
    
    const updates = [];
    const values = [];
    
    if (company_name !== undefined) {
      updates.push('company_name = ?');
      values.push(company_name);
    }
    if (valid_until !== undefined) {
      updates.push('valid_until = ?');
      values.push(valid_until);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        code: 400,
        message: '没有要更新的字段',
        data: null
      });
    }
    
    values.push(id);
    
    const [result] = await pool.query(
      `UPDATE companies SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        code: 404,
        message: '公司不存在',
        data: null
      });
    }
    
    res.json({
      code: 200,
      message: '更新成功',
      data: null
    });
  } catch (error) {
    console.error('更新公司失败:', error);
    res.status(500).json({
      code: 500,
      message: '更新失败',
      data: null
    });
  }
};

// 删除公司
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 软删除，将状态设为禁用
    const [result] = await pool.query(
      'UPDATE companies SET status = 0 WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        code: 404,
        message: '公司不存在',
        data: null
      });
    }
    
    res.json({
      code: 200,
      message: '删除成功',
      data: null
    });
  } catch (error) {
    console.error('删除公司失败:', error);
    res.status(500).json({
      code: 500,
      message: '删除失败',
      data: null
    });
  }
};
