import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileEditorDialogComponent } from './profile-editor-dialog.component';

describe('ProfileEditorDialogComponent', () => {
  let component: ProfileEditorDialogComponent;
  let fixture: ComponentFixture<ProfileEditorDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileEditorDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ProfileEditorDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
