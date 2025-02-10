import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChannelDescriptionDialogComponent } from './channel-description-dialog.component';

describe('ChannelDescriptionDialogComponent', () => {
  let component: ChannelDescriptionDialogComponent;
  let fixture: ComponentFixture<ChannelDescriptionDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelDescriptionDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ChannelDescriptionDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
