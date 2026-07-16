import { Component, inject } from '@angular/core';
import { AccountService } from '../../core/services/account-service';
import { PhotoManagement } from "./photo-management/photo-management";
import { UserManagement } from "./user-management/user-management";

@Component({
  selector: 'app-admin',
  imports: [PhotoManagement, UserManagement],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin {
  protected accountService = inject(AccountService);
  activeTab = 'photos';
  tabs = [
    {label: 'Photo moderation', value: 'photos'},
    {label: 'User management', value: 'roles'},
  ]

  setTab(tab: string) {
    this.activeTab = tab;
  }
}
