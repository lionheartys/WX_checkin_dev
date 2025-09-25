const api = require('../../utils/request.js')
const util = require('../../utils/util.js')

Page({
  data: {
    userId: null,

    // 项目
    projects: [],
    projectNames: [],
    projectIndex: 0,

    // 打卡地
    locations: [],
    locationNames: [],
    locationIndex: 0,

    // 入/离场
    inOutLabels: ['入场', '离场'],
    inOutValues: ['entry', 'exit'],
    inOutIndex: 0,

    // 预计离场
    date: '',
    time: '',
    dateStart: '',
    dateEnd: '',

    // 申请原因（新增）
    reason: '',

    // 状态
    loading: { projects: false, locations: false },
    submitting: false,
    canSubmit: false
  },

  onLoad() {
    this.initDateTime();
    this.loadUserIdFromStorage();
    this.fetchProjects();
  },

  // 读取 userId（仅用于提交，不展示）
  loadUserIdFromStorage() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || !userInfo.id) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    this.setData({ userId: userInfo.id }, this.recomputeCanSubmit);
  },

  // 滚轮日期时间
  initDateTime() {
    const now = new Date();
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const start = date;
    const endDate = new Date(now.getTime()); endDate.setDate(endDate.getDate() + 365);
    const dateEnd = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`;
    this.setData({ date, time, dateStart: start, dateEnd });
  },

  // 拉项目
  fetchProjects() {
    this.setData({ 'loading.projects': true });
  
    api.getProjectList()
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data
                   : Array.isArray(res)       ? res
                   : [];
  
        // 统一映射字段，确保都有 id 和 project_name
        const projects = list.map(p => ({
          id:               p.id ?? p.project_id ?? p.ID,
          project_name:     p.project_name ?? p.name ?? p.title ?? `项目${p.id ?? p.project_id ?? ''}`,
          // 其它可能要用的字段也可以顺带带上
          raw: p
        })).filter(p => p.id);
  
        if (!projects.length) {
          wx.showToast({ title: '暂无项目', icon: 'none' });
          this.setData({ projects: [], projectIndex: 0 });
          return;
        }
  
        this.setData({ projects, projectIndex: 0 }, () => {
          // 拉取第一个项目的打卡地
          this.fetchLocationsByProject(projects[0].id);
          this.recomputeCanSubmit();
        });
      })
      .catch(() => {
        wx.showToast({ title: '项目列表获取失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ 'loading.projects': false });
      });
  },

  // 联动拉打卡地
  fetchLocationsByProject(projectId) {
    if (!projectId) {
      this.setData({ locations: [], locationIndex: 0 }, this.recomputeCanSubmit);
      return;
    }
    this.setData({ 'loading.locations': true });
  
    api.getProjectLocations(projectId)
      .then((res) => {
        // 兼容后端返回：直接数组 或 { data: [...] } 等
        const raw = Array.isArray(res?.data) ? res.data
                 : Array.isArray(res?.data?.data) ? res.data.data
                 : Array.isArray(res) ? res
                 : [];
  
        // 标准化为 { id, location_name }
        const locations = raw.map(l => ({
          id: l.id ?? l.location_id ?? l.ID,
          location_name: l.location_name ?? l.name ?? l.title ?? `地点${l.id ?? l.location_id ?? ''}`,
          raw: l
        })).filter(l => l.id);
  
        if (!locations.length) {
          this.setData({ locations: [], locationIndex: 0 }, this.recomputeCanSubmit);
          wx.showToast({ title: '该项目暂无打卡地', icon: 'none' });
          return;
        }
  
        // 可选：按名称排序，避免乱序
        locations.sort((a, b) => (a.location_name || '').localeCompare(b.location_name || '', 'zh'));
  
        this.setData({ locations, locationIndex: 0 }, this.recomputeCanSubmit);
      })
      .catch(() => {
        this.setData({ locations: [], locationIndex: 0 }, this.recomputeCanSubmit);
        wx.showToast({ title: '加载打卡地失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ 'loading.locations': false });
      });
  },

  // 交互
  onProjectChange(e) {
    const projectIndex = Number(e.detail.value);
    this.setData({ projectIndex, locations: [], locationNames: [], locationIndex: 0 }, () => {
      const project = this.data.projects[projectIndex];
      if (project && project.id) this.fetchLocationsByProject(project.id);
      this.recomputeCanSubmit();
    });
  },
  onLocationChange(e) { this.setData({ locationIndex: Number(e.detail.value) }, this.recomputeCanSubmit); },
  onInOutChange(e) { this.setData({ inOutIndex: Number(e.detail.value) }); },
  onDateChange(e) { this.setData({ date: e.detail.value }); },
  onTimeChange(e) { this.setData({ time: e.detail.value }); },
  onReasonInput(e) { this.setData({ reason: e.detail.value.trim() }, this.recomputeCanSubmit); },

  // 校验（是否允许提交）
  recomputeCanSubmit() {
    const { userId, projects, projectIndex, locations, locationIndex, reason } = this.data;
    const baseReady = !!(userId && projects.length && projects[projectIndex] && locations.length && locations[locationIndex]);
    // 如果“申请原因”必填：
    const reasonOk = reason && reason.length >= 2; // 自定义阈值
    const ok = baseReady && reasonOk;
    if (this.data.canSubmit !== ok) this.setData({ canSubmit: ok });
  },

  // 提交：调用封装的 projectInApplySubmit
  onSubmit() {
    if (!this.data.canSubmit) {
      wx.showToast({ title: '请先完善表单', icon: 'none' });
      return;
    }
    
    const {
      userId, projects, projectIndex,
      locations, locationIndex,
      inOutValues, inOutIndex,
      date, time, reason
    } = this.data;
  
    // 与 MySQL 表字段对齐
    const payload = {
      user_id: userId,
      project_id: projects[projectIndex].id,
      location_id: locations[locationIndex].id,
      entry_type: inOutValues[inOutIndex],        // 'entry' | 'exit'
      expect_leavetime: `${date} ${time}:00`,     // DATETIME
      apply_reason: reason
    };
  
    this.setData({ submitting: true });
  
    api.projectApplySubmit(payload)
      .then((res) => {
        console.log('返回状态码为', res.code);
  
        // 检查后端返回的 code 来判断是否成功
        if (res.code === 200 || res.code === 201) {
          wx.showToast({ title: '提交成功', icon: 'success' });
          setTimeout(() => wx.navigateBack({ delta: 1 }), 800);
          return;
        }
  
        // 处理冲突情况 (409 错误码)
        else if (res.code === 409) {
          wx.showToast({ title: '该用户已有同类型申请处于审批状态，请勿重复提交', icon: 'none' });
        } else {
          // 如果返回的 code 不是 200 或 409，获取详细的错误信息
          let msg = (res.message || '提交失败');
          wx.showToast({ title: msg, icon: 'none' });
        }
      })
      .catch((error) => {
        console.error('请求失败:', error);
        wx.showToast({ title: '申请提交失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ submitting: false });
      });
  },

})