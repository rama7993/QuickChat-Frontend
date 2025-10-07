import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ThemeService } from '../../core/services/theme/theme.service';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterModule],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
})
export class AuthLayoutComponent implements OnInit, OnDestroy {
  private themeService = inject(ThemeService);
  private originalTheme: string | null = null;

  ngOnInit() {
    // Store the original theme
    this.originalTheme = localStorage.getItem('quickchat-theme');
    
    // Force dark mode for auth pages
    this.themeService.setTheme('dark-mode');
  }

  ngOnDestroy() {
    // Restore the original theme when leaving auth pages
    if (this.originalTheme) {
      this.themeService.setTheme(this.originalTheme);
    }
  }
}
