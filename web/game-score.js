import {quantile} from './model.js';

export function judgeReplay(forecast,result){
 const baselineMedian=quantile(forecast.baselineTerminal,.5);
 const baselineError=Math.abs(baselineMedian-result.actualIndex);
 return{won:result.covered&&result.medianError<baselineError-1e-9,baselineError};
}
