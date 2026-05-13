import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Register } from '../account/register/register';
import { DiscoveryService } from '../../core/services/discovery-service';
import { AccountService } from '../../core/services/account-service';
import { DiscoveryCookDto } from '../../types/favorite';
import { CookCard } from '../../shared/cook-card/cook-card';

@Component({
  selector: 'app-home',
  imports: [Register, RouterLink, CookCard],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private discoveryService = inject(DiscoveryService);
  protected accountService = inject(AccountService);

  protected registerMode = signal(false);
  protected popularCooks = signal<DiscoveryCookDto[]>([]);
  protected newCooks = signal<DiscoveryCookDto[]>([]);

  ngOnInit() {
    this.discoveryService.getNew().subscribe({
      next: cooks => this.newCooks.set(cooks),
      error: () => {},
    });

    const zip = localStorage.getItem('zipCode');
    if (zip) {
      this.discoveryService.getNearMe(zip).subscribe({
        next: cooks => this.popularCooks.set(cooks),
        error: () => this.loadPopularFallback(),
      });
    } else {
      this.loadPopularFallback();
    }
  }

  loadPopularFallback() {
    this.discoveryService.getPopular().subscribe({
      next: cooks => this.popularCooks.set(cooks),
      error: () => {},
    });
  }

  showRegister(value: boolean) {
    this.registerMode.set(value);
  }
}
