import {Injectable} from '@angular/core';
import xlsx from 'node-xlsx';
import * as XLSX from 'xlsx-style';
import bufferFrom from 'buffer-from';
import {UploadFile} from 'ng-zorro-antd';
import {Item} from '../../model/item.model';
import {StoreService} from '..';
import {Data} from '../../model/data.model';
import {Analyzation} from '../../model/analyzation.model';
import {Workbook} from '../../model/workbook.model';
import {Project} from "../../model/project.model";
import {FileService} from "../file/file.service";

@Injectable({
  providedIn: 'root'
})
export class XlsxService {

  private _TIMEZONE_OFFSET = new Date().getTimezoneOffset() * 60 * 1000;
  private _BASE_DATE = +(new Date(Date.UTC(1899, 11, 30)));
  private _COLUMNS = {
    id: 'ID',
    owner: '指派给',
    taskType: '任务类型',
    title: '标题',
    status: '状况',
    startTime: '实际开始时间',
    endTime: '实际结束时间',
    predictWork: 'PM预估工作量',
    finishWork: '已完成工作'
  };
  //单元格外侧框线
  private _BORDER_ALL = {
    top: {
      style: 'thin'
    },
    bottom: {
      style: 'thin'
    },
    left: {
      style: 'thin'
    },
    right: {
      style: 'thin'
    }
  };
  private _HEADER_STYLE = {
    font: {
      name: '仿宋_GB2312',
      sz: 10,
      bold: true,
      italic: false,
      underline: false
    },
    alignment: {
      horizontal: 'center',
      vertical: 'center'
    },
    fill: {
      fgColor: {rgb: 'C0C0C0'},
    }
  };
  // 头部行号
  headerIndex = 1;

  constructor(private store: StoreService, private file: FileService) {
  }

  // 数据分析
  analyse(file: UploadFile) {
    return new Promise<Analyzation[]>((resolve, reject) => {
      const worksheets = xlsx.parse(file.path);
      if (this.verify(worksheets)) {
        const rows = worksheets[0].data;
        const worksheetsColumn: Array<String> = rows[this.headerIndex];
        const columnIndex = {};
        Object.keys(this._COLUMNS).forEach(k => {
          columnIndex[k] = worksheetsColumn.indexOf(this._COLUMNS[k])
        });
        // 组装数据
        let list: Item[] = [];
        for (let i = this.headerIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          const item = {} as Item;
          Object.keys(columnIndex).forEach(k => {
            const value = row[columnIndex[k]];
            if (k == 'startTime' || k === 'endTime') {
              if (typeof value === 'string') {
                item[k] = new Date(value)
              } else {
                item[k] = this.num2Date(row[columnIndex[k]])
              }
            } else {
              item[k] = row[columnIndex[k]]
            }
          });
          if (item.owner) {
            list.push(item)
          }
        }
        // 获取涉及的月份
        const distinctTimeItems = this.groupBy(list, 'startTime').map(i => i[0]);
        const monthList = [];
        for (let i = 0; i < distinctTimeItems.length; i++) {
          const startTime = this.parseTime(distinctTimeItems[i].startTime, '{y}-{m}');
          if (startTime && monthList.indexOf(startTime) === -1) {
            monthList.push(startTime)
          }
        }

        const ownerList = this.groupBy(list, 'owner').map(i => i[0].owner);
        const userList = this.store.getUserList().filter(u => ownerList.includes(u.name));

        // 分析记录
        const analyzations: Analyzation[] = [];
        for (let i = 0; i < monthList.length; i++) {
          const analyzation = new Analyzation();
          analyzation.month = monthList[i];
          analyzation.memberData = [];
          const [year, month] = analyzation.month.split('-');
          const maxDate = this.lastDateOfMonth(year, month).getTime();
          const minDate = new Date(+year, +month - 1, 1).getTime();
          const targetItems = list.filter(item => new Date(item.startTime).getTime() >= minDate && new Date(item.startTime).getTime() <= maxDate);
          const targetGroups = this.groupBy(targetItems, 'owner');
          targetGroups.forEach(group => {
            const data = new Data();
            data.user = userList.find(u => u.name === group[0].owner);
            data.items = group.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
            data.totalFinishWork = data.items.reduce((total, item) => total + item.finishWork, 0);
            data.totalPredictWork = data.items.reduce((total, item) => total + item.predictWork, 0);
            analyzation.memberData.push(data)
          });
          analyzation.memberData.sort((a, b) => a.user.id.localeCompare(b.user.id));
          analyzations.push(analyzation);
        }
        resolve(analyzations)
      } else {
        reject(-1)
      }
    })
  }

  // 处理分析数据
  handleAnalyzations(project: Project, analyzations: Analyzation[]) {
    const data = [];
    analyzations.forEach(analyzation => {
      const result: any = {};
      const [year, month] = analyzation.month.split('-');
      result.month = analyzation.month;
      result.data = [];
      const weeks = this.weekGroups(+year, +month);
      for (let i = 0; i < weeks.length; i++) {
        const days = weeks[i].filter(w => w);
        let weekItems = [];
        analyzation.memberData.forEach(data => {
          const user = data.user;
          const weekUserItems = data.items
            .filter(item => {
              return new Date(item.startTime).getTime() >= days[0].getTime() && new Date(item.endTime).getTime() <= days[days.length - 1].getTime()
            })
            .map(item => {
              return [project.id, project.name, '合作厂商', user.id, user.name, item.taskType, item.id, item.title, item.status, new Date(item.startTime), new Date(item.endTime), item.predictWork, item.finishWork, '']
            });
          weekItems = weekItems.concat(weekUserItems);
        });
        result.data.push(weekItems)
      }
      data.push(result);
    });
    return data;
  }

  // 写入数据
  writeFile(project: Project, data: any[]) {
    const baseName = `${project.id}-${project.name}`;
    return new Promise(async (resolve, reject) => {
      try {
        // 清空数据
        this.cleanUp();
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          const [year, month] = item.month.split('-');
          const path = await this.file.mkdir(item.month);
          const weeks = this.weekGroups(+year, +month);
          for (let j = 0; j < item.data.length; j++) {
            const days = weeks[j].filter(w => w);
            const startDay = this.parseTime(days[0], '{y}年{m}月{d}日');
            const endDay = this.parseTime(days[days.length - 1], '{y}年{m}月{d}日');
            await this.file.writeFile(path, `${baseName}-${startDay}-${endDay} - 开发.xlsx`, this.excelBuffer(item.data[j]))
          }
        }
      } catch (e) {
        reject(e);
      }
      resolve()
    });
  }

  // 保存打包数据
  saveArchiveFile(savePath) {
    this.file.archive(savePath);
  }

  // 清除生成的文件
  cleanUp() {
    this.file.cleanUp()
  }

  // 字段验证
  verify(worksheets) {
    if (worksheets.length > 0) {
      const data = worksheets[0].data;
      if (data.length >= 1) {
        let worksheetsColumn: Array<String> = data[0];
        if (Object.keys(this._COLUMNS).every(k => worksheetsColumn.includes(this._COLUMNS[k]))) {
          this.headerIndex = 0;
          return true;
        } else if (data.length >= 2) {
          this.headerIndex = 1;
          worksheetsColumn = data[1];
          return Object.keys(this._COLUMNS).every(k => worksheetsColumn.includes(this._COLUMNS[k]));
        }
      }
    }
    return false;
  }

  // 分组
  groupBy(array, key) {
    const groups = {};
    array.forEach((i) => {
      const group = JSON.stringify(i[key]);
      groups[group] = groups[group] || [];
      groups[group].push(i);
    });
    return Object.keys(groups).map((group) => groups[group]);
  }

  // 每月星期分组
  weekGroups(year: number, month: number): [Date][] {
    const weeks = [];
    let week = [];
    const lastDate = new Date(year, month, 0).getDate();
    for (let i = 1; i <= lastDate; i++) {
      const date = new Date(2020, month - 1, i);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0) {
        week[6] = date;
        weeks.push(week);
        week = []
      } else {
        week[dayOfWeek - 1] = date;
        if (i === lastDate) {
          weeks.push(week);
        }
      }
    }
    return weeks;
  }

  // 时间类型转数字
  data2Num(date) {
    const epoch = Date.parse(date);
    return (epoch - this._BASE_DATE - this._TIMEZONE_OFFSET) / (24 * 60 * 60 * 1000);
  }

  // 数字转时间类型
  num2Date(num) {
    return new Date((num * 24 * 60 * 60 * 1000) + this._BASE_DATE + this._TIMEZONE_OFFSET)
  }

  // 月份最后一天
  lastDateOfMonth(year, month) {
    return new Date(year, month, 0)
  }

  // 时间格式化
  parseTime(time, cFormat = '{y}-{m}-{d} {h}:{i}:{s}') {
    if (arguments.length === 0) {
      return null
    }
    const format = cFormat || '{y}-{m}-{d} {h}:{i}:{s}';
    const date = new Date(time);
    const formatObj = {
      y: date.getFullYear(),
      m: date.getMonth() + 1,
      d: date.getDate(),
      h: date.getHours(),
      i: date.getMinutes(),
      s: date.getSeconds(),
      a: date.getDay()
    };
    const time_str = format.replace(/{(y|m|d|h|i|s|a)+}/g, (result, k) => {
      let value = formatObj[k];
      // Note: getDay() returns 0 on Sunday
      if (k === 'a') {
        return ['日', '一', '二', '三', '四', '五', '六'][value]
      }
      if (result.length > 0 && value < 10) {
        value = '0' + value
      }
      return value || 0
    });
    return time_str
  }

  // region Excel

  // 转Buffer
  excelBuffer(data): Buffer {
    const wb = new Workbook();
    this.insertSheet_1(wb);
    this.insertSheet_2(wb, data);
    this.insertSheet_3(wb);
    this.insertSheet_4(wb);
    this.insertSheet_5(wb);
    this.insertSheet_6(wb);
    this.insertSheet_7(wb);
    this.insertSheet_8(wb);
    this.insertSheet_9(wb);
    this.insertSheet_10(wb);
    const excel = XLSX.write(wb, {
      bookType: 'xlsx',
      bookSST: false,
      type: 'binary'
    });
    return excel instanceof Buffer ? excel : bufferFrom(excel, 'binary');
  }

  // 通用Sheet制作
  makeCommonSheet(wb: Workbook, options: { name: string, headers: string[][], data?: any[][], cols?: { wch: number }[] }) {
    const sheet = this.sheetFromArrayOfArrays(options.headers, options.data);
    // 给所有单元格加上边框
    for (let i in sheet) {
      if (i == '!ref' || i == '!merges' || i == '!cols') {
        // continue
      } else {
        sheet[i + ''].s = {
          border: this._BORDER_ALL,
          ...this._HEADER_STYLE
        }
      }
    }
    if (options.cols) {
      sheet['!cols'] = options.cols;
    }
    wb.SheetNames.push(options.name);
    wb.Sheets[options.name] = sheet
  }

  // 项目进度 Sheet
  insertSheet_1(wb: Workbook) {
    this.makeCommonSheet(wb, {
      name: '项目进度',
      headers: [['系统编号', '系统名称', '计划任务编号', '计划任务名称', '计划开始时间', '计划完成时间', '负责人', '完成百分比']],
      cols: [{wch: 10}, {wch: 14}, {wch: 14}, {wch: 32}, {wch: 14}, {wch: 14}, {wch: 14}, {wch: 16}]
    });
  }

  // 工时记录 Sheet
  insertSheet_2(wb: Workbook, data) {
    const options = {
      name: '工时记录',
      headers: [['系统编号', '系统名称', '人员类型', '人员编号', '人员姓名', '任务类型', '任务编号', '任务描述', '任务状态', '开始日期', '结束日期', '计划工时', '实际工时', '备注']],
      cols: [{wch: 10}, {wch: 16}, {wch: 10}, {wch: 10}, {wch: 10}, {wch: 16}, {wch: 10}, {wch: 24}, {wch: 10}, {wch: 12}, {wch: 12}, {wch: 10}, {wch: 10}, {wch: 6}],
      rows: [{hpx: 16}],
    };
    const sheet = this.sheetFromArrayOfArrays(options.headers, data);
    // 给所有单元格加上边框
    for (let i in sheet) {
      if (i == '!ref' || i == '!merges' || i == '!cols') {
        // continue
      } else {
        const k = i + '';
        const row = k.match(new RegExp(/\d+/));
        if (!options.rows[+row - 1]) {
          options.rows[+row - 1] = {hpx: 20}
        }
        let style: any = {
          border: this._BORDER_ALL
        };
        if (row && +row[0] === 1) {
          // header
          style = {
            ...style,
            font: {
              name: '仿宋_GB2312',
              sz: 10,
              bold: true,
              italic: false,
              underline: false
            },
            alignment: {
              horizontal: 'center',
              vertical: 'center'
            }
          }
        } else {
          const font = {
            name: '宋体',
            sz: 10,
            bold: false,
            italic: false,
            underline: false
          };
          if (!k.startsWith('H')) {
            style = {
              ...style,
              font,
              alignment: {
                horizontal: 'center',
                vertical: 'center'
              }
            }
          } else {
            style = {
              ...style,
              font,
              alignment: {
                horizontal: 'left',
                vertical: 'center'
              }
            }
          }
        }
        sheet[i + ''].s = style;
      }
    }
    sheet['!cols'] = options.cols;
    sheet['!rows'] = options.rows;
    wb.SheetNames.push(options.name);
    wb.Sheets[options.name] = sheet
  }

  // 下周计划 Sheet
  insertSheet_3(wb: Workbook) {
    const options = {
      name: '下周计划',
      headers: [['系统编号', '系统名称', '人员类型', '人员编号', '人员姓名', '任务类型', '任务编号', '计划任务描述', '任务状态', '计划开始日期', '计划完成日期', '计划工时', '计划工时上限', '备注']],
      cols: [{wch: 10}, {wch: 16}, {wch: 10}, {wch: 14}, {wch: 10}, {wch: 16}, {wch: 16}, {wch: 24}, {wch: 10}, {wch: 14}, {wch: 14}, {wch: 10}, {wch: 14}, {wch: 6}]
    };
    const sheet = this.sheetFromArrayOfArrays(options.headers);
    // 给所有单元格加上边框
    for (let i in sheet) {
      if (i == '!ref' || i == '!merges' || i == '!cols') {
        // continue
      } else {
        sheet[i + ''].s = {
          border: this._BORDER_ALL,
          font: {
            name: '仿宋_GB2312',
            sz: 10,
            bold: true,
            italic: false,
            underline: false
          },
          alignment: {
            horizontal: 'center',
            vertical: 'center'
          }
        }
      }
    }
    sheet['!cols'] = options.cols;
    wb.SheetNames.push(options.name);
    wb.Sheets[options.name] = sheet
  }

  // 问题及风险 Sheet
  insertSheet_4(wb: Workbook) {
    this.makeCommonSheet(wb, {
      name: '问题及风险',
      headers: [['系统编号', '系统名称', '问题及风险描述', '影响范围', '对策', '识别人', '处理人', '风险类型', '严重性', '可能性', '风险状态', '提出时间', '发生时间', '解决时间']],
      cols: [{wch: 10}, {wch: 14}, {wch: 30}, {wch: 10}, {wch: 30}, {wch: 8}, {wch: 8}, {wch: 10}, {wch: 8}, {wch: 8}, {wch: 10}, {wch: 10}, {wch: 10}, {wch: 10}]
    });
  }

  // 交付物 Sheet
  insertSheet_5(wb: Workbook) {
    this.makeCommonSheet(wb, {
      name: '交付物',
      headers: [['系统编号', '系统名称', '成果描述', '负责人', '完成日期', '状态']],
      cols: [{wch: 10}, {wch: 14}, {wch: 30}, {wch: 8}, {wch: 10}, {wch: 8}]
    });
  }

  // 重要变更 Sheet
  insertSheet_6(wb: Workbook) {
    this.makeCommonSheet(wb, {
      name: '重要变更',
      headers: [['系统编号', '系统名称', '变更的内容', '变更的原因和已做的工作', '对既定计划的影响', '变更方案或建议', '协调关联方', '提交时间', '提交人']],
      cols: [{wch: 10}, {wch: 14}, {wch: 28}, {wch: 30}, {wch: 28}, {wch: 28}, {wch: 28}, {wch: 20}, {wch: 8}]
    });
  }

  // 填写说明 Sheet
  insertSheet_7(wb: Workbook) {
    const options = {
      name: '填写说明',
      headers: [['编号', '填写说明']],
      data: [
        [1, '项目周报不仅是记录人员工时、下周计划、提交物、重要变更等方面项目最新情况，也从另一侧面反映项目管理、风险识别能力的成熟度，同时也是向高层领导汇报的一个渠道。'],
        [2, '周报提交时间每周五下午，按系统上传配置管理平台，目前配置管理平台的工具是Firefly，如更换到TFS等工具，将另行通知。'],
        [3, '周报文件名命名规则：系统编号-系统名称-xxxx年xx月xx日.xls'],
        [4, '配置管理平台项目周报路径：项目管理->项目监控->项目状态报告->项目周报->系统名称；授予各项目经理下载、上传、建立本地工作区的权限。'],
        [5, '“项目进度”标签页填写项目重要任务长期计划的进度情况，概要说明项目需求分析、设计开发、版本测试、质量管理、版本进度等情况。'],
        [6, '“工时记录”标签页填写项目组每人每周工时情况。注意一行只能填写一个人名，同时除了合作厂商技术服务人员，我公司员工工时也要填报；此工时对合作厂商作为付款依据。'],
        [7, '“下周计划”标签页根据项目组情况简要或详细填写下周工作计划。'],
        [8, '“问题和风险”标签页填写对项目风险的识别情况或项目内部重要问题的处理记录。'],
        [9, '“提交物”标签页填写本周项目主要提交物，记录项目资产积累。'],
        [10, '“重要变更”标签页填写项目需要高层审批或需跨处室、部门协调等项目重要变更事项，生产问题紧急补丁计划要在此这记录。'],
        [11, '“任务类型说明”列举研发过程主要任务，如有需要变更，请联系项目质量处统一调整。'],
        [12, '“风险检查参考”列举研发项目风险识别要考虑的问题。'],
        [13, '“字段说明”对填报的关键字段进行说明。'],
        [14, '由于各标签页最后要转为csv格式，导入数据库批量汇总，各数据项填写时不要不含英文逗号和“|"。'],
        [15, '为统计完整工时，请假也当作一种任务分类记录；加班工时包含在实际工时中，如果计划工时记录正常工作时间，则加班工时即实际工时与计划工时的差额。'],
        [16, '对聘请专家等零散人力采购项目，可根据有效工作时间段填报周报，不必每周填报。'],
        [17, '本模板的最新版本可从内网-信息技术部-规则制度中下载。']
      ],
      cols: [{wch: 10}, {wch: 130}]
    };
    const sheet = this.sheetFromArrayOfArrays(options.headers, options.data);
    // 给所有单元格加上边框
    for (let i in sheet) {
      if (i == '!ref' || i == '!merges' || i == '!cols') {
        // continue
      } else {
        const k = i + '';
        const row = k.match(new RegExp(/\d+/));
        let style: any = {
          border: this._BORDER_ALL
        };
        if (row && +row[0] === 1) {
          // header
          style = {
            ...style,
            ...this._HEADER_STYLE
          }
        } else {
          const font = {
            name: '宋体',
            sz: 10,
            bold: false,
            italic: false,
            underline: false
          };
          if (k.startsWith('A')) {
            style = {
              ...style,
              font,
              alignment: {
                horizontal: 'center',
                vertical: 'center'
              }
            }
          } else {
            style = {
              ...style,
              font,
              alignment: {
                horizontal: 'left',
                vertical: 'center'
              }
            }
          }
        }
        sheet[i + ''].s = style;
      }
    }
    sheet['!cols'] = options.cols;
    wb.SheetNames.push(options.name);
    wb.Sheets[options.name] = sheet;
  }

  // 字段说明 Sheet
  insertSheet_8(wb: Workbook) {
    const options = {
      name: '字段说明',
      headers: [['类别', '填写说明']],
      data: [
        ['系统编号', '填写需求管理部预算编号，参见项目清单表，如预算编号对应多个项目，后面加两位数字区分。'],
        ['系统名称', '填写系统中文名称，参见项目清单表。'],
        ['计划任务编号', '自行定义开发计划的编号，可以是project等编号'],
        ['计划任务名称', '计划开发任务的内容，建议包含需求分析、设计开发、版本测试、质量管理、版本进度等。'],
        ['人员编号', '填写公司上网通行码，无通行码需填报身份证号。'],
        ['人员姓名', '项目的人员姓名，一行只能填写一个人名。'],
        ['开始日期', '具体填写的日期，周报的开始日期，一般为每周的周一，格式为yyyy/mm/dd。'],
        ['结束日期', '具体填写的日期，周报的结束日期，一般为每周的周五，格式为yyyy/mm/dd。'],
        ['任务类型', '可选项：需求分析、设计、编码、测试等，详细见任务类型说明，注意任务类型包含请假。'],
        ['任务编号', '本任务由OA软件需求单和需求管理平台需求发起的相关任务时，填写OA软件需求单号或需求管理平台需求业务需求号。本任务由解决JIRA问题发起时，请填写JIRA问题编号。可为空。'],
        ['任务描述', '工作的详细描述，因逗号为分隔符，内容中不能包含逗号。'],
        ['任务状态', '可选项：未开始、过程中、已完成、延期、取消。'],
        ['计划工时', '1、人员本周该项工作计划投入的小时数\r\n2、请假需要填写工时。'],
        ['实际工时', '1、人员本周该项工作实际投入的小时数，可含加班时间，此工时为合同付款时间参考依据。\r\n2、请假需要填写工时，此工时为合同付款时间参考依据。'],
        ['备注', '补充情况说明']
      ],
      cols: [{wch: 10}, {wch: 100}],
      rows: [{hpx: 16}, {hpx: 16}, {hpx: 16}, {hpx: 16}, {hpx: 16}, {hpx: 16}, {hpx: 16}, {hpx: 16}, {hpx: 16}, {hpx: 16}, {hpx: 35}, {hpx: 16}, {hpx: 16}, {hpx: 35}, {hpx: 35}, {hpx: 16}],
    };
    const sheet = this.sheetFromArrayOfArrays(options.headers, options.data);
    // 给所有单元格加上边框
    for (let i in sheet) {
      if (i == '!ref' || i == '!merges' || i == '!cols') {
        // continue
      } else {
        const k = i + '';
        const row = k.match(new RegExp(/\d+/));
        let style: any = {
          border: this._BORDER_ALL
        };
        if (row && +row[0] === 1) {
          // header
          style = {
            ...style,
            ...this._HEADER_STYLE
          }
        } else {
          const font = {
            name: '宋体',
            sz: 10,
            bold: false,
            italic: false,
            underline: false
          };
          if (k.startsWith('A')) {
            style = {
              ...style,
              font,
              alignment: {
                horizontal: 'center',
                vertical: 'center'
              }
            }
          } else {
            style = {
              ...style,
              font,
              alignment: {
                wrapText: true,
                horizontal: 'left',
                vertical: 'center'
              }
            }
          }
        }
        sheet[i + ''].s = style;
      }
    }
    sheet['!cols'] = options.cols;
    sheet['!rows'] = options.rows;
    wb.SheetNames.push(options.name);
    wb.Sheets[options.name] = sheet;
  }

  // 任务类型说明 Sheet
  insertSheet_9(wb: Workbook) {
    const options = {
      name: '任务类型说明',
      headers: [['任务类型', '任务类型说明']],
      data: [
        ["A01-用户需求说明书确认", "需求分析确认后，完善需求说明书"],
        ["A02-需求活动（除评审）", "需求分析过程"],
        ["A03-需求评审", "需求分析会及讨论"],
        ["A04-设计活动（除评审）", "设计分析过程"],
        ["A05-设计评审", "设计分析会及讨论"],
        ["A06-编码", "开发人员编码"],
        ["A07-代码走查", "组长或设计人员代码走查"],
        ["A08-编码自测", "开发人员自测，也称单元测试"],
        ["A09-修复缺陷", "对识别的缺陷进行修复的活动；"],
        ["A10-编写文档", "编写操作手册、安装手册等"],
        ["B01-项目例会", "每周项目例会"],
        ["B02-开发计划", "制定版本、补丁或其他开发计划"],
        ["B03-项目管理", "包括制定计划和管理评审及编写周报等管理活动；"],
        ["B04-支持维护", "开发、测试人员对生产问题分析处理"],
        ["B05-配置管理", "配置管理岗配置操作"],
        ["B06-问题平台问题解决", "开发、测试人员对jira、mantis等生产问题分析处理"],
        ["B07-环境准备", "环境搭建、测试数据准备"],
        ["B08-过程改进", "所有项目成员共同参与"],
        ["B09-培训", "项目内部开展的技术管理相关培训任务；"],
        ["C01-测试计划", "编写测试计划"],
        ["C02-测试需求分析", "进行测试需求分析"],
        ["C03-测试方案", "编写测试方案"],
        ["C04-测试评审", "进行测试评审"],
        ["C05-测试用例设计", "编写测试场景和用例设计"],
        ["C06-集成测试", "测试人与参与的模块功能测试"],
        ["C07-系统测试", "系统测试"],
        ["C07-验收测试", "验收测试支持"],
        ["C08-回归测试 ", "回归测试"],
        ["C09-安装测试", "安装测试"],
        ["D01-质量保证计划", "质量保证计划"],
        ["D02-质量检查", "质量检查"],
        ["D03-QA周报", "QA岗分析总结"],
        ["D04-QA阶段总结报告", "QA阶段总结报告"],
        ["E01-请假", "项目人员请假，请假需要填写工时，影响合同付款"],
        ["F01-其他", "不能够明确归属于以上任何一种类别的那些活动比如:沟通、会议等。"]
      ],
      cols: [{wch: 20}, {wch: 55}],
    };

    const sheet = this.sheetFromArrayOfArrays(options.headers, options.data);
    // 给所有单元格加上边框
    for (let i in sheet) {
      if (i == '!ref' || i == '!merges' || i == '!cols') {
        // continue
      } else {
        const k = i + '';
        const row = k.match(new RegExp(/\d+/));
        let style: any = {
          border: this._BORDER_ALL
        };
        if (row && +row[0] === 1) {
          // header
          style = {
            ...style,
            ...this._HEADER_STYLE
          }
        } else {
          style = {
            ...style,
            font: {
              name: '宋体',
              sz: 10,
              bold: false,
              italic: false,
              underline: false
            },
            alignment: {
              horizontal: 'left',
              vertical: 'center'
            }
          }
        }
        sheet[i + ''].s = style;
      }
    }
    sheet['!cols'] = options.cols;
    wb.SheetNames.push(options.name);
    wb.Sheets[options.name] = sheet;
  }

  // 风险检查参考 Sheet
  insertSheet_10(wb: Workbook) {
    const options = {
      name: '风险检查参考',
      headers: [["分类", "风险类型", "检查项编号", "检查项"]],
      data: [
        ["业务类", "合规", "A01", "是否违反政府、或者其他机构的合同法、劳动法等相关法规"],
        ["", "", "A02", "是否违反保监会、行业协会等行业相关规定"],
        ["", "", "A03", "是否项目推广后可能导致公司发生重大的损失"],
        ["", "业务需求", "B01", "是否开发很少有人真正需要的服务或功能"],
        ["", "", "B02", "是否开发成本超过整个公司受益"],
        ["", "", "B03", "业务的需求是否清晰"],
        ["", "", "B04", "业务是否频繁改动需求"],
        ["", "", "B05", "业务指定的需求和交付期限在客观上可行"],
        ["", "", "B06", "业务对产品的健壮性、可靠性、性能等质量因素有过高要求"],
        ["技术类", "需求分析", "C01", "需求分析会是否邀请业务、测试、开发、测试中心人员共同参与"],
        ["", "", "C02", "需求开发人员是否了解项目所涉及的具体业务吗、否理解用户的需求"],
        ["", "", "C03", "需求开发人员能否获得业务人员对需求文档的承诺，对有争议的需求达成共识，减少需求变更"],
        ["", "", "C04", "需求文档是否能够正确地、完备地表达用户需求"],
        ["", "综合技术", "D01", "开发人员是否已经掌握了本项目的关键技术，是否遵守公司制定的架构规范"],
        ["", "", "D02", "分析与设计工作是否过于简单导致程序员边做边改"],
        ["", "", "D03", "是否对所有重要的工作成果进行正式评审或快速检查"],
        ["", "", "D04", "开发人员是否参与需求分析过程"],
        ["", "", "D05", "开发设计人员是否考虑到性能问题，是否考索引、缓存等优化措施"],
        ["", "", "D06", "待开发的功能是否与外部系统相连接或与未曾证实的软硬件连接"],
        ["", "", "D07", "项目是否有独立的测试人员、测试效率是否满足要求"],
        ["", "", "D08", "开发人员是否有质量意识，是否会在进度延误时降低质量要求"],
        ["", "", "D09", "开发人员是否能够按照配置管理规范执行版本控制、变更控制"],
        ["管理类", "项目计划", "E01", "对项目的规模、难度估计是否比较准确"],
        ["", "", "E02", "项目的预算是否充足"],
        ["", "", "E03", "开发人员、管理人员等人力资源或水平是否达到要求"],
        ["", "", "E04", "项目所需的软件、硬件、售后服务等能按时到位"],
        ["", "", "E05", "进度安排是否过于紧张，有合理的缓冲时间，是否可能出现某项工作延误导致其他一连串的工作也被延误"],
        ["", "", "E06", "进度表中是否遗漏一些重要的或必要的任务，是否考虑了关键路径"],
        ["", "", "E07", "是否对风险进行识别"],
        ["", "", "E08", "是否制定测试计划"],
        ["", "", "E09", "是否制定质量保证计划"],
        ["", "", "E10", "任务分配是否合理、是否把任务分配给充分发挥其才能的项目成员"],
        ["", "", "E11", "是否考虑采用、购买成熟的软件模块"],
        ["", "项目团队", "F01", "项目组内成员沟通是否通畅"],
        ["", "", "F02", "技术开发队伍中是否有不满足合同要求或未办理入场登记人员"],
        ["", "", "F03", "本项目开发过程中是否会有核心人员辞职、调动"],
        ["", "", "F04", "是否能保证人员流动基本不会影响工作的连续性"],
        ["", "", "F05", "开发人员是否有开发相似产品的经验，项目的业务规则、技术是否难以掌握"]
      ],
      cols: [{wch: 10}, {wch: 10}, {wch: 10}, {wch: 80}],
      merges: ['A2:A10', 'A11:A23', 'A24:A39', 'B2:B4', 'B5:B10', 'B11:B14', 'B15:B23', 'B24:B34', 'B35:B39']
    };

    const sheet = this.sheetFromArrayOfArrays(options.headers, options.data);
    // 给所有单元格加上边框
    for (let i in sheet) {
      if (i == '!ref' || i == '!merges' || i == '!cols') {
        // continue
      } else {
        const k = i + '';
        const row = k.match(new RegExp(/\d+/));
        let style: any = {
          border: this._BORDER_ALL
        };
        if (row && +row[0] === 1) {
          // header
          style = {
            ...style,
            ...this._HEADER_STYLE
          }
        } else {
          if (k.startsWith('A') || k.startsWith('B') || k.startsWith('C')) {
            style = {
              ...style,
              font: {
                name: '宋体',
                sz: 10,
                bold: k.startsWith('A'),
                italic: false,
                underline: false
              },
              alignment: {
                horizontal: 'center',
                vertical: 'center'
              }
            }
          } else {
            style = {
              ...style,
              font: {
                name: '宋体',
                sz: 10,
                bold: false,
                italic: false,
                underline: false
              },
              alignment: {
                horizontal: 'left',
                vertical: 'center'
              }
            }
          }
        }
        sheet[i + ''].s = style;
      }
    }
    sheet['!cols'] = options.cols;
    if (options.merges.length > 0) {
      if (!sheet['!merges']) sheet['!merges'] = []
      options.merges.forEach(item => {
        sheet['!merges'].push(XLSX.utils.decode_range(item))
      })
    }
    wb.SheetNames.push(options.name);
    wb.Sheets[options.name] = sheet;
  }

  // 表格内容转换
  sheetFromArrayOfArrays(headers, data = []) {
    const ws = {};
    const range = {
      s: {
        c: 10000000,
        r: 10000000
      },
      e: {
        c: 0,
        r: 0
      }
    };
    /*设置worksheet每列的最大宽度*/
    for (let R = 0; R !== headers.length; ++R) {
      for (let C = 0; C !== headers[R].length; ++C) {
        if (range.s.r > R) range.s.r = R;
        if (range.s.c > C) range.s.c = C;
        if (range.e.r < R) range.e.r = R;
        if (range.e.c < C) range.e.c = C;
        const cell: any = {
          v: headers[R][C]
        };
        if (cell.v == null) continue;
        const cell_ref = XLSX.utils.encode_cell({
          c: C,
          r: R
        });

        if (typeof cell.v === 'number') {
          cell.t = 'n'
        } else if (typeof cell.v === 'boolean') {
          cell.t = 'b'
        } else if (cell.v instanceof Date) {
          cell.t = 'n';
          cell.z = xlsx.SSF._table[14];
          cell.v = this.data2Num(cell.v)
        } else {
          cell.t = 's'
        }
        ws[cell_ref] = cell
      }
    }
    for (let R = headers.length; R !== data.length + headers.length; ++R) {
      for (let C = 0; C !== data[R - headers.length].length; ++C) {
        if (range.s.r > R) range.s.r = R;
        if (range.s.c > C) range.s.c = C;
        if (range.e.r < R) range.e.r = R;
        if (range.e.c < C) range.e.c = C;
        const cell: any = {
          v: data[R - headers.length][C]
        };
        if (cell.v == null) continue;
        const cell_ref = XLSX.utils.encode_cell({
          c: C,
          r: R
        });

        if (typeof cell.v === 'number') {
          cell.t = 'n'
        } else if (typeof cell.v === 'boolean') {
          cell.t = 'b'
        } else if (cell.v instanceof Date) {
          cell.t = 'n';

          cell.z = XLSX.SSF._table[14];
          cell.v = this.data2Num(cell.v)
        } else {
          cell.t = 's'
        }
        ws[cell_ref] = cell
      }
    }
    if (range.s.c < 10000000) ws['!ref'] = XLSX.utils.encode_range(range);
    return ws
  }

  // endregion
}
