export class Item {
  // ID
  id: String;
  // 指派给
  owner: String;
  // 任务类型
  taskType: String;
  // 标题
  title: String;
  // 状况
  status: String;
  // 实际开始时间
  startTime: number | Date;
  // 实际结束时间
  endTime: number | Date;
  // PM预估工作量
  predictWork: number;
  // 已完成工作
  finishWork: number;
}
