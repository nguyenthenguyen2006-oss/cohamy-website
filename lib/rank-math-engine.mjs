import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
const directory=path.join(process.cwd(),'wordpress/rank-math-analysis');
const manifest=JSON.parse(readFileSync(path.join(directory,'manifest.json'),'utf8'));
const assets=new Map(manifest.assets.map(asset=>{
  const source=readFileSync(path.join(directory,'assets',asset.name),'utf8');
  if(createHash('sha256').update(source).digest('hex')!==asset.sha256) throw new Error('RANK_MATH_ENGINE_HASH_MISMATCH'); return [asset.name,source];
}));
export async function analyzeRankMath(input) {
  if(input.rank_math_version!==manifest.rank_math_version) throw new Error('RANK_MATH_ENGINE_VERSION_MISMATCH');
  if(!input.keywords.length) return {state:'awaiting_keyword',score:null,version:manifest.rank_math_version};
  const dom=new JSDOM('',{url:input.base_url,runScripts:'outside-only'});
  try {
    const context=dom.getInternalVMContext(); const window=dom.window;
    // All scripts are trusted local distribution assets checked above, never article content.
    for(const name of ['lodash','jquery','hooks','i18n','wordcount','autop','html-entities','url']) vm.runInContext(assets.get(name+'.js'),context,{timeout:2000,filename:'wordpress-'+name+'.js'});
    context.lodash=context._;
    window.XMLHttpRequest=function () { throw new Error('RANK_MATH_WORKER_NETWORK_FORBIDDEN'); };
    context.rankMath={noFollowExternalLinks:input.nofollow_external,noFollowDomains:input.nofollow_domains,noFollowExcludeDomains:input.nofollow_exclusions,parentDomain:input.base_url,links:{},assessor:{hasTOCPlugin:false,focusKeywordLink:(input.cms_url || 'https://cms.cohamy.vn')+'/wp-admin/edit.php?rank_math_focus_keyword=%focus_keyword%&post_type=%post_type%'},objectType:'post',postType:input.post_type,localeFull:input.locale};
    vm.runInContext(assets.get('analyzer.js'),context,{timeout:2000,filename:'rank-math-analyzer.js'});
    const {Paper,Analyzer,ResultManager}=window.rankMathAnalyzer;
    const analyzer=new Analyzer({i18n:window.wp.i18n}); const manager=new ResultManager(); const summaries=[];
    for(let i=0;i<input.keywords.length;i++) {
      const keyword=input.keywords[i]; const paper=new Paper(input.content_html,{locale:input.locale});
      paper.setTitle(input.title);paper.setDescription(input.description);paper.setKeyword(keyword);paper.setKeywords(input.keywords);paper.setUrl(input.url);paper.setPermalink(input.slug);paper.setPostType(input.post_type);paper.setThumbnail(input.thumbnail);paper.setThumbnailAltText(input.thumbnail_alt);paper.setSchema(input.schemas || {});
      analyzer.defaultAnalyses.keywordNotUsed.keywordsChecked[paper.getLower('keyword').trim()]=input.keyword_is_new[i];
      const results=await analyzer.analyze(paper); manager.update(keyword,results,i===0);
      summaries.push({keyword,score:manager.getScore(keyword),tests:Object.entries(results).map(([name,result])=>({name,score:result.getScore(),max:result.getMaxScore(input.locale.split('_')[0]),message:result.getText()}))});
    }
    return {state:'analyzed',score:manager.getScore(input.keywords[0]),version:manifest.rank_math_version,results:summaries};
  } finally { dom.window.close(); }
}
