import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectAvatarComponent } from './select-avatar.component';

describe('SelectAvatarComponent', () => {
  let component: SelectAvatarComponent;
  let fixture: ComponentFixture<SelectAvatarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectAvatarComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SelectAvatarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
