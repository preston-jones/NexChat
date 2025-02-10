import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChannelCreatedInfoComponent } from './channel-created-info.component';

describe('ChannelCreatedInfoComponent', () => {
  let component: ChannelCreatedInfoComponent;
  let fixture: ComponentFixture<ChannelCreatedInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelCreatedInfoComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ChannelCreatedInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
