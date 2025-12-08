import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GroupService } from '../../../../core/services/group/group.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { Group } from '../../../../core/interfaces/group.model';
import { User } from '../../../../core/interfaces/group.model';

@Component({
  selector: 'app-create-group',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-group.component.html',
  styleUrl: './create-group.component.scss',
})
export class CreateGroupComponent implements OnInit {
  private groupService = inject(GroupService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // Form data
  groupName = signal('');
  groupDescription = signal('');
  groupType = signal<'public' | 'private' | 'secret'>('public');
  selectedMembers = signal<User[]>([]);
  availableUsers = signal<User[]>([]);
  searchQuery = signal('');
  isCreating = signal(false);
  errorMessage = signal('');

  // UI state
  showMemberSelector = signal(false);
  showAdvancedSettings = signal(false);

  // Advanced settings
  allowInviteLinks = signal(true);
  allowMemberInvites = signal(true);
  requireApproval = signal(false);
  maxMembers = signal(100);

  ngOnInit() {
    this.loadAvailableUsers();
  }

  private loadAvailableUsers() {
    this.groupService.getAvailableUsers().subscribe({
      next: (users: User[]) => {
        if (users) {
          const currentUser = this.authService.currentUser();
          const filteredUsers = currentUser
            ? users.filter((u) => u._id !== currentUser._id)
            : users;
          this.availableUsers.set(filteredUsers);
        }
      },
      error: (error: any) => {
        console.error('Error loading users:', error);
        this.availableUsers.set([]);
      },
    });
  }

  get filteredUsers() {
    const query = this.searchQuery().toLowerCase();
    return this.availableUsers().filter(
      (user) =>
        user.firstName.toLowerCase().includes(query) ||
        user.lastName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }

  toggleMemberSelection(user: User) {
    const selected = this.selectedMembers();
    const index = selected.findIndex((u) => u._id === user._id);

    if (index > -1) {
      selected.splice(index, 1);
    } else {
      selected.push(user);
    }

    this.selectedMembers.set([...selected]);
  }

  isMemberSelected(user: User): boolean {
    return this.selectedMembers().some((u) => u._id === user._id);
  }

  removeMember(user: User) {
    const selected = this.selectedMembers().filter((u) => u._id !== user._id);
    this.selectedMembers.set(selected);
  }

  createGroup() {
    if (!this.groupName().trim()) {
      this.errorMessage.set('Group name is required');
      return;
    }

    this.isCreating.set(true);
    this.errorMessage.set('');

    const groupData = {
      name: this.groupName().trim(),
      description: this.groupDescription().trim(),
      groupType: this.groupType(),
      members: this.selectedMembers().map((u) => u._id),
      settings: {
        allowInviteLinks: this.allowInviteLinks(),
        allowMemberInvites: this.allowMemberInvites(),
        requireApproval: this.requireApproval(),
        maxMembers: this.maxMembers(),
      },
    };

    this.groupService
      .createGroup(
        groupData.name,
        groupData.description,
        groupData.members,
        groupData.groupType
      )
      .subscribe({
        next: (newGroup: Group) => {
          if (newGroup) {
            // Navigate to the new group
            this.router.navigate(['/chat'], {
              queryParams: { group: newGroup._id },
            });
          }
          this.isCreating.set(false);
        },
        error: (error: any) => {
          this.errorMessage.set(error.message || 'Failed to create group');
          this.isCreating.set(false);
        },
      });
  }

  cancel() {
    this.router.navigate(['/chat']);
  }

  toggleAdvancedSettings() {
    this.showAdvancedSettings.set(!this.showAdvancedSettings());
  }

  toggleMemberSelector() {
    this.showMemberSelector.set(!this.showMemberSelector());
  }
}
