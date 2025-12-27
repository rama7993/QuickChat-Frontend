import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme/theme.service';
import { AuthService } from './core/services/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'QuickChat';
  private themeService = inject(ThemeService);
  private authService = inject(AuthService);

  ngOnInit() {
    // Initialize theme service
    this.themeService.getCurrentTheme();

    // Token refresh is now handled automatically by AuthService
    // No need for periodic token checking
  }

  ngOnDestroy() {
    // Cleanup handled by AuthService
  }
}
