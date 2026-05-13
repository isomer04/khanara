import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PhotoManagement } from './photo-management';

describe('PhotoManagement', () => {
  let component: PhotoManagement;
  let fixture: ComponentFixture<PhotoManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhotoManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PhotoManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
