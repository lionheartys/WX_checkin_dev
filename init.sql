-- 微信打卡小程序数据库设计
-- Database: wechat_checkin

-- 1. 公司表
CREATE TABLE companies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_name VARCHAR(100) NOT NULL COMMENT '公司名称',
    valid_until DATE NOT NULL COMMENT '有效期',
    status TINYINT DEFAULT 1 COMMENT '状态: 1-启用, 0-禁用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_valid_until (valid_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公司信息表';

-- 2. 用户表
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    openid VARCHAR(100) UNIQUE NOT NULL COMMENT '微信openid',
    username VARCHAR(50) NOT NULL COMMENT '用户名',
    phone VARCHAR(20) NOT NULL COMMENT '手机号',
    password VARCHAR(255) COMMENT '加密后的密码',
    company_id INT COMMENT '所属公司ID',
    role ENUM('admin', 'project_manager', 'staff') DEFAULT 'staff' COMMENT '用户角色',
    device_id VARCHAR(100) COMMENT '常用设备ID',
    status ENUM('pending', 'approved', 'rejected', 'disabled') DEFAULT 'pending' COMMENT '用户状态',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    contract_expire_time DATETIME NULL COMMENT '合同到期时间',
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
    INDEX idx_openid (openid),
    INDEX idx_phone (phone),
    INDEX idx_company (company_id),
    INDEX idx_role (role),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户信息表';

-- 3. 项目表
CREATE TABLE projects (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_name VARCHAR(100) NOT NULL COMMENT '项目名称',
    general_unit VARCHAR(100) COMMENT '总体单位名称',
    manager_id INT COMMENT '项目负责人ID',
    manager_name VARCHAR(50) COMMENT '项目负责人姓名',
    status TINYINT DEFAULT 1 COMMENT '状态: 1-启用, 0-禁用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_manager (manager_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目信息表';

-- 4. 打卡地点表
CREATE TABLE checkin_locations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL COMMENT '所属项目ID',
    location_name VARCHAR(100) NOT NULL COMMENT '打卡地名称',
    longitude DECIMAL(10, 7) NOT NULL COMMENT '经度',
    latitude DECIMAL(10, 7) NOT NULL COMMENT '纬度',
    work_start_time TIME NOT NULL COMMENT '上班时间',
    work_end_time TIME NOT NULL COMMENT '下班时间',
    checkin_range INT DEFAULT 200 COMMENT '打卡范围(米)',
    abnormal_threshold INT DEFAULT 30 COMMENT '考勤异常阈值(分钟)',
    status TINYINT DEFAULT 1 COMMENT '状态: 1-启用, 0-禁用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project (project_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='打卡地点表';

-- 5. 项目入场申请表
CREATE TABLE project_entries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '用户ID',
    project_id INT NOT NULL COMMENT '项目ID',
    location_id INT NOT NULL COMMENT '打卡地ID',
    entry_type ENUM('entry', 'exit') NOT NULL COMMENT '申请类型: entry-入场, exit-离场',
    apply_reason TEXT COMMENT '申请原因',
    status ENUM('pending', 'approved', 'rejected', 'expired') DEFAULT 'pending' COMMENT '审批状态：pending - 待审批, approved - 已批准, rejected - 已拒绝, expired - 已过期',
    approver_id INT COMMENT '审批人ID',
    approve_time DATETIME COMMENT '审批时间',
    approve_remark TEXT COMMENT '审批备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expect_leavetime DATETIME COMMENT '预计离场时间',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES checkin_locations(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL,
   -- UNIQUE KEY uk_user_location (user_id, location_id, entry_type),
    INDEX idx_user (user_id),
    INDEX idx_project (project_id),
    INDEX idx_location (location_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目入场申请表';


-- 6. 打卡记录表
CREATE TABLE checkin_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '用户ID',
    location_id INT NOT NULL COMMENT '打卡地ID',
    checkin_type ENUM('in', 'out') NOT NULL COMMENT '打卡类型: in-上班, out-下班',
    checkin_time DATETIME NOT NULL COMMENT '打卡时间',
    longitude DECIMAL(10, 7) NOT NULL COMMENT '打卡经度',
    latitude DECIMAL(10, 7) NOT NULL COMMENT '打卡纬度',
    device_id VARCHAR(100) COMMENT '设备ID',
    checkin_status ENUM('normal', 'late', 'early', 'absent', 'leave', 'holiday', 'abnormal') DEFAULT 'normal' 
        COMMENT '打卡状态: normal-正常, late-迟到, early-早退, absent-缺勤, leave-请假, holiday-休假, abnormal-异常',
    abnormal_reason VARCHAR(500) COMMENT '异常原因',
    is_device_abnormal TINYINT DEFAULT 0 COMMENT '是否设备异常: 1-是, 0-否',
    is_location_abnormal TINYINT DEFAULT 0 COMMENT '是否位置异常: 1-是, 0-否',
    remark TEXT COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES checkin_locations(id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, checkin_time),
    INDEX idx_location_date (location_id, checkin_time),
    INDEX idx_status (checkin_status),
    INDEX idx_checkin_time (checkin_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='打卡记录表';

-- 7. 补卡申请表
CREATE TABLE makeup_applications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '用户ID',
    location_id INT NOT NULL COMMENT '打卡地ID',
    makeup_date DATE NOT NULL COMMENT '补卡日期',
    makeup_type ENUM('in', 'out') NOT NULL COMMENT '补卡类型: in-上班, out-下班',
    reason TEXT NOT NULL COMMENT '补卡原因',
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT '审批状态',
    approver_id INT COMMENT '审批人ID',
    approve_time DATETIME COMMENT '审批时间',
    approve_remark TEXT COMMENT '审批备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES checkin_locations(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_status (status),
    INDEX idx_date (makeup_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='补卡申请表';

-- 8. 请假类型表
CREATE TABLE leave_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type_name VARCHAR(50) NOT NULL UNIQUE COMMENT '请假类型名称',
    type_code VARCHAR(20) NOT NULL UNIQUE COMMENT '类型代码',
    is_system TINYINT DEFAULT 0 COMMENT '是否系统预设: 1-是, 0-否',
    status TINYINT DEFAULT 1 COMMENT '状态: 1-启用, 0-禁用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='请假类型表';

-- 插入系统预设请假类型
INSERT INTO leave_types (type_name, type_code, is_system) VALUES
('年假', 'annual', 1),
('事假', 'personal', 1),
('调休', 'compensatory', 1),
('产假', 'maternity', 1),
('婚假', 'marriage', 1),
('病假', 'sick', 1),
('其他', 'other', 1);

-- 9. 调休额度表
CREATE TABLE compensatory_quota (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '用户ID',
    project_id INT NOT NULL COMMENT '项目ID',
    start_date DATE NOT NULL COMMENT '出差开始日期',
    end_date DATE NOT NULL COMMENT '出差结束日期',
    business_days INT NOT NULL COMMENT '出差天数',
    quota_days DECIMAL(4,1) NOT NULL COMMENT '可调休天数',
    used_days DECIMAL(4,1) DEFAULT 0 COMMENT '已使用天数',
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT '审批状态',
    approver_id INT COMMENT '审批人ID',
    approve_time DATETIME COMMENT '审批时间',
    approve_remark TEXT COMMENT '审批备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_project (project_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='调休额度表';

-- 10. 请假申请表
CREATE TABLE leave_applications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '用户ID',
    leave_type_id INT NOT NULL COMMENT '请假类型ID',
    start_date DATE NOT NULL COMMENT '请假开始日期',
    end_date DATE NOT NULL COMMENT '请假结束日期',
    leave_days DECIMAL(4,1) NOT NULL COMMENT '请假天数',
    reason TEXT NOT NULL COMMENT '请假原因',
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending' COMMENT '审批状态',
    approver_id INT COMMENT '审批人ID',
    approve_time DATETIME COMMENT '审批时间',
    approve_remark TEXT COMMENT '审批备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_type (leave_type_id),
    INDEX idx_status (status),
    INDEX idx_date_range (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='请假申请表';

-- 11. 考勤申诉表
CREATE TABLE attendance_appeals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '用户ID',
    record_id INT NOT NULL COMMENT '打卡记录ID',
    appeal_reason TEXT NOT NULL COMMENT '申诉原因',
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT '审批状态',
    approver_id INT COMMENT '审批人ID',
    approve_time DATETIME COMMENT '审批时间',
    approve_remark TEXT COMMENT '审批备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (record_id) REFERENCES checkin_records(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_record (record_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='考勤申诉表';

-- 12. 操作日志表
CREATE TABLE operation_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '操作用户ID',
    operation_type VARCHAR(50) NOT NULL COMMENT '操作类型',
    target_type VARCHAR(50) NOT NULL COMMENT '目标类型',
    target_id INT NOT NULL COMMENT '目标ID',
    operation_detail TEXT COMMENT '操作详情',
    ip_address VARCHAR(50) COMMENT 'IP地址',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_operation (operation_type),
    INDEX idx_target (target_type, target_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';