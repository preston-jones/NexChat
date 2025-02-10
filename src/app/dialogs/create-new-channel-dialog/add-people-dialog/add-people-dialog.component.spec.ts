import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddPeopleDialogComponent } from './add-people-dialog.component';

describe('AddPeopleDialogComponent', () => {
  let component: AddPeopleDialogComponent;
  let fixture: ComponentFixture<AddPeopleDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddPeopleDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(AddPeopleDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
