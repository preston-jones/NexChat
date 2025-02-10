import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberAddedInfoComponent } from './member-added-info.component';

describe('MemberAddedInfoComponent', () => {
  let component: MemberAddedInfoComponent;
  let fixture: ComponentFixture<MemberAddedInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberAddedInfoComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MemberAddedInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
