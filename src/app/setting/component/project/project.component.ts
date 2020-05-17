import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {NzMessageService, NzModalService} from "ng-zorro-antd";
import {StoreService, NotificationService} from "../../../core/services";
import {Project} from "../../../core/model/project.model";

@Component({
  selector: 'app-project',
  templateUrl: './project.component.html',
  styleUrls: ['./project.component.scss']
})
export class ProjectComponent implements OnInit {
  // 项目列表
  data: Project[];
  // 项目编辑弹窗是否可见
  isVisible = false;
  // 是否新增项目
  isCreate = false;
  // 验证表单
  validateForm!: FormGroup;

  constructor(private fb: FormBuilder, private modal: NzModalService, private message: NzMessageService, private store: StoreService, private notification: NotificationService) {
  }

  ngOnInit(): void {
    this.data = this.store.getProjectList();
    this.validateForm = this.fb.group({
      id: [null, [Validators.required]],
      name: [null, [Validators.required]]
    });
  }

  // 打开弹窗
  openModal(project, isCreate) {
    this.isCreate = isCreate;
    for (const key in this.validateForm.controls) {
      this.validateForm.controls[key].setValue(isCreate ? '' : project[key])
    }
    if (isCreate) {
      this.validateForm.reset()
    }
    this.isVisible = true;
  }

  // 关闭弹窗
  closeModal() {
    this.isVisible = false;
  }

  // 保存项目
  saveProject(project) {
    let valid = true;
    for (const key in this.validateForm.controls) {
      this.validateForm.controls[key].markAsDirty();
      this.validateForm.controls[key].updateValueAndValidity();
      if (!this.validateForm.controls[key].valid) {
        valid = false
      }
    }
    if (valid) {
      if (this.isCreate && this.data.some(item => item.id === project.id)) {
        this.modal.confirm({
          nzTitle: '重复数据',
          nzContent: '已存在该项目信息，是否覆盖？',
          nzOnOk: () => {
            const target = this.data.find((item) => item.id === project.id);
            target.id = project.id;
            target.name = project.name;
            this.store.setProjectList(this.data);
            this.message.remove();
            this.message.success('保存成功');
            this.closeModal()
          }
        });
      } else if (!this.isCreate) {
        const target = this.data.find((item) => item.id === project.id);
        target.id = project.id;
        target.name = project.name;
        this.store.setProjectList(this.data);
        if (target.checked) {
          this.notification.post('project-updated', target);
        }
        this.message.remove();
        this.message.success('保存成功');
        this.closeModal()
      } else {
        this.data.push(project);
        this.data = this.data.concat();
        this.store.setProjectList(this.data);
        this.message.remove();
        this.message.success('保存成功');
        this.closeModal()
      }
    }
  }

  // 删除项目
  deleteProject(project) {
    this.modal.confirm({
      nzTitle: '操作确认',
      nzContent: '是否删除该项目？',
      nzOkType: 'danger',
      nzOnOk: () => {
        this.data = this.data.filter(item => item.id !== project.id);
        this.store.setProjectList(this.data);
        this.message.remove();
        this.message.success('删除成功');
        const currentProject = this.store.getProjectList().find(i => i.checked);
        if (!currentProject) {
          this.notification.post('project-updated', null)
        }
      }
    });
  }

  handleCheckedChange(project) {
    this.data.filter(i => i.checked).forEach(i => i.checked = false);
    this.data.find(i => i.id === project.id).checked = true;
    this.store.setProjectList(this.data);
    this.notification.post('project-updated', project);
    this.message.remove();
    this.message.success(`已使用 ${project.name} 配置`)
  }

}
