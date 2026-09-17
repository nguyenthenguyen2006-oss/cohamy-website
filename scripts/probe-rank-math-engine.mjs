import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import vm from 'node:vm';
const dom=new JSDOM('',{url:'https://cohamy.vn',runScripts:'outside-only'}); const window=dom.window;
const context=dom.getInternalVMContext();
vm.runInContext(readFileSync('wordpress/rank-math-analysis/assets/lodash.js','utf8'),context); context.lodash=context._;
vm.runInContext(readFileSync('wordpress/rank-math-analysis/assets/jquery.js','utf8'),context); context.jQuery=window.jQuery;
for(const name of ['hooks','i18n','wordcount','autop','html-entities','url']) { vm.runInContext(readFileSync('wordpress/rank-math-analysis/assets/'+name+'.js','utf8'),context); context.wp=window.wp; }
context.rankMath={noFollowExternalLinks:false,noFollowDomains:[],noFollowExcludeDomains:[],parentDomain:'https://cohamy.vn',links:{},assessor:{hasTOCPlugin:false},objectType:'post',postType:'post',localeFull:'vi_VN'};
try { vm.runInContext(readFileSync('wordpress/rank-math-analysis/assets/analyzer.js','utf8'),context); } catch(error) { console.error(error.message); process.exit(1); }
const engine=window.rankMathAnalyzer;
console.log('Paper methods',Object.getOwnPropertyNames(engine.Paper.prototype));
console.log('Analyzer methods',Object.getOwnPropertyNames(engine.Analyzer.prototype));
console.log('Manager update',engine.ResultManager.prototype.update.toString());
const paper=new engine.Paper('<h2>Cohamy</h2><p>Cohamy là thương hiệu chocolate.</p>',{locale:'vi_VN'});
paper.setTitle('Cohamy chocolate');paper.setKeyword('Cohamy');paper.setKeywords(['Cohamy']);paper.setDescription('Khám phá chocolate Cohamy.');paper.setUrl('https://cohamy.vn/vi/bai-viet/cohamy');paper.setPermalink('cohamy');
const analyzer=new engine.Analyzer({i18n:window.wp.i18n});
console.log('Keyword analysis fields',Object.keys(analyzer.defaultAnalyses.keywordNotUsed));
analyzer.defaultAnalyses.keywordNotUsed.keywordsChecked={cohamy:true};
let results;try {results=await analyzer.analyze(paper);}catch(error){console.error(error.message);process.exit(1);}
console.log('Results',Object.entries(results).map(([name,result])=>({name,score:result.getScore(),max:result.getMaxScore('vi')})));
const manager=new engine.ResultManager(); manager.update('Cohamy',results,true); console.log('Real score',manager.getScore('Cohamy'));
dom.window.close();
