import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CbFeedComponent } from './components/cb-feed/cb-feed.component';
import { CandleComponent } from './components/candle/candle.component';

@NgModule({
  declarations: [
    AppComponent,
    CbFeedComponent,
    CandleComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
