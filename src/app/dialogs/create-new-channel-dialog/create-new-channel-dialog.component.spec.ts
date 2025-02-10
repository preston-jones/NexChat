import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateNewChannelDialogComponent } from './create-new-channel-dialog.component';

describe('CreateNewChannelDialogComponent', () => {
  let component: CreateNewChannelDialogComponent;
  let fixture: ComponentFixture<CreateNewChannelDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateNewChannelDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CreateNewChannelDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
