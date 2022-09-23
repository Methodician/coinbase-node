import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CbFeedComponent } from './cb-feed.component';

describe('CbFeedComponent', () => {
  let component: CbFeedComponent;
  let fixture: ComponentFixture<CbFeedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CbFeedComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CbFeedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
