-- SET NAMES utf8mb4;

-- INSERT INTO leave_types (type_name, type_code, is_system) VALUES
-- ('年假', 'annual', 1),
-- ('事假', 'personal', 1),
-- ('调休', 'compensatory', 1),
-- ('产假', 'maternity', 1),
-- ('婚假', 'marriage', 1),
-- ('病假', 'sick', 1),
-- ('其他', 'other', 1);

-- ALTER TABLE project_entries
-- ADD COLUMN expect_leavetime DATETIME COMMENT '预计离场时间',
-- MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'expired') DEFAULT 'pending' COMMENT '审批状态：pending - 待审批, approved - 已批准, rejected - 已拒绝, expired - 已过期';

INSERT INTO project_entries (user_id, project_id, location_id, entry_type, apply_reason, status, approver_id, approve_time, approve_remark, expect_leavetime)
VALUES 
(12, 1, 2, 'entry', '进行一些测试', 'pending', NULL, NULL, NULL, '2025-09-27 18:00:00'),
(12, 2, 7, 'entry', '也需要进行测试', 'pending', NULL, NULL, NULL, '2025-09-22 18:00:00');
