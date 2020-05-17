import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from "@angular/forms";
import {NzMessageService, NzModalService} from "ng-zorro-antd";
import {StoreService} from "../../../core/services";
import {User} from "../../../core/model/user.model";

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserComponent implements OnInit {
  // 用户列表
  data: User[];
  // 用户编辑弹窗是否可见
  isVisible = false;
  // 是否新增用户
  isCreate = false;
  // 验证表单
  validateForm!: FormGroup;

  constructor(private fb: FormBuilder, private modal: NzModalService, private message: NzMessageService, private store: StoreService) {
  }

  ngOnInit(): void {
    this.data = this.store.getUserList();
    this.validateForm = this.fb.group({
      id: [null, [Validators.required]],
      name: [null, [Validators.required]]
    });
  }

  // 打开弹窗
  openModal(user, isCreate) {
    this.isCreate = isCreate;
    for (const key in this.validateForm.controls) {
      this.validateForm.controls[key].setValue(isCreate ? '' : user[key])
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

  // 保存用户
  saveUser(user) {
    let valid = true;
    for (const key in this.validateForm.controls) {
      this.validateForm.controls[key].markAsDirty();
      this.validateForm.controls[key].updateValueAndValidity();
      if (!this.validateForm.controls[key].valid) {
        valid = false
      }
    }
    if (valid) {
      if (this.isCreate && this.data.some(item => item.id === user.id)) {
        this.modal.confirm({
          nzTitle: '重复数据',
          nzContent: '已存在该工号信息，是否覆盖？',
          nzOnOk: () => {
            const target = this.data.find((item) => item.id === user.id);
            target.id = user.id;
            target.name = user.name;
            this.store.setUserList(this.data);
            this.message.remove();
            this.message.success('保存成功');
            this.closeModal()
          }
        });
      } else if (!this.isCreate) {
        const target = this.data.find((item) => item.id === user.id);
        target.id = user.id;
        target.name = user.name;
        this.store.setUserList(this.data);
        this.message.remove();
        this.message.success('保存成功');
        this.closeModal()
      } else {
        this.data.push(user);
        this.data = this.data.concat();
        this.store.setUserList(this.data);
        this.message.remove();
        this.message.success('保存成功');
        this.closeModal()
      }
    }
  }

  // 删除用户
  deleteUser(user) {
    this.modal.confirm({
      nzTitle: '操作确认',
      nzContent: '是否删除该人员？',
      nzOkType: 'danger',
      nzOnOk: () => {
        this.data = this.data.filter(item => item.id !== user.id);
        this.store.setUserList(this.data);
        this.message.remove();
        this.message.success('删除成功');
      }
    });
  }

}
