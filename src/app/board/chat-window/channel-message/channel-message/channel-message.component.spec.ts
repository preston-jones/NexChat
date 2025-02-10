import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChannelMessageComponent } from './channel-message.component';

describe('ChannelMessageComponent', () => {
  let component: ChannelMessageComponent;
  let fixture: ComponentFixture<ChannelMessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelMessageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ChannelMessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
