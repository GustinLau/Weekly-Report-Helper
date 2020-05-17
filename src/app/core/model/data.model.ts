import {Item} from "./item.model";
import {User} from "./user.model";

export class Data {
  // 人员
  user: User;
  // 总估时
  totalPredictWork: number;
  // 总完成工作
  totalFinishWork: number;
  // 项目
  items: Item[]
}
