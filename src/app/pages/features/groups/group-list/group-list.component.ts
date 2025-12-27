import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GroupService } from '../../../../core/services/group/group.service';
import { Group } from '../../../../core/interfaces/group.model';

@Component({
  selector: 'app-group-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './group-list.component.html',
  styleUrl: './group-list.component.scss',
})
export class GroupListComponent implements OnInit {
  private groupService = inject(GroupService);
  private router = inject(Router);

  groups = signal<Group[]>([]);
  isLoading = signal(true);
  searchQuery = signal('');

  ngOnInit() {
    this.loadGroups();
  }

  private loadGroups() {
    this.isLoading.set(true);
    this.groupService.getMyGroups().subscribe({
      next: (groups: Group[]) => {
        if (groups) {
          this.groups.set(groups);
        }
        this.isLoading.set(false);
      },
      error: (error: any) => {
        console.error('Error loading groups:', error);
        this.groups.set([]);
        this.isLoading.set(false);
      },
    });
  }

  get filteredGroups() {
    const query = this.searchQuery().toLowerCase();
    return this.groups().filter(
      (group) =>
        group.name.toLowerCase().includes(query) ||
        group.description.toLowerCase().includes(query)
    );
  }

  selectGroup(group: Group) {
    this.router.navigate(['/chat'], {
      queryParams: { group: group._id },
    });
  }

  createGroup() {
    this.router.navigate(['/create-group']);
  }

  goBack() {
    this.router.navigate(['/chat']);
  }
}
