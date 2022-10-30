import { Component, OnInit } from '@angular/core';
import { CbFeedService, MergedTrade } from 'src/app/services/cb-feed.service';

@Component({
  selector: 'app-cb-feed',
  templateUrl: './cb-feed.component.html',
  styleUrls: ['./cb-feed.component.scss'],
})
export class CbFeedComponent implements OnInit {
  socketTrades: MergedTrade[] = [];
  historicalTrades?: MergedTrade[];

  ethLine$ = this.cbFeedSvc.getLinearTrades$('ETH-USD', 200);

  constructor(private cbFeedSvc: CbFeedService) {
    this.transferFeed();
  }

  ngOnInit(): void {}

  transferFeed = () => {
    let wasContinuityChecked = false;
    this.ethLine$.subscribe((ethLine) => {
      const { historicalTrades, processedTradeStream$ } =
        ethLine.transferFeed();
      processedTradeStream$.subscribe((trade) => {
        if (!wasContinuityChecked) {
          const lastHistoricalId =
            historicalTrades[historicalTrades.length - 1].tradeId;
          console.log('lastHistoricalId', lastHistoricalId);
          const firstSocketId = trade.tradeId;
          console.log('firstSocketId', firstSocketId);
          if (lastHistoricalId !== firstSocketId - 1) {
            alert('Trade ID continuity was broken');
          }
          wasContinuityChecked = true;
        }
        this.socketTrades.push(trade);
      });
      this.historicalTrades = historicalTrades;
    });
  };

  // temp
  tradeIds = (trades?: MergedTrade[]) =>
    !!trades ? trades.map((t) => t.tradeId) : [];
}
