import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThreadMessagesComponent } from './thread-messages.component';

describe('ThreadMessagesComponent', () => {
  let component: ThreadMessagesComponent;
  let fixture: ComponentFixture<ThreadMessagesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThreadMessagesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ThreadMessagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
