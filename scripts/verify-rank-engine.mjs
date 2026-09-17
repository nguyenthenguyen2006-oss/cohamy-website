import assert from 'node:assert/strict';
import {analyzeRankMath} from '../lib/rank-math-engine.mjs';
const input={rank_math_version:'1.0.278',base_url:'https://cohamy.vn',url:'https://cohamy.vn/vi/bai-viet/public-mu5wad3m',post_type:'post',locale:'en_US',title:'Rank Math public-mu5wad3m',description:'Mô tả public-mu5wad3m',slug:'public-mu5wad3m',content_html:'<h2 class="wp-block-heading">Cohamy</h2><p class="wp-block-paragraph">ACTUAL_PUBLIC_public-mu5wad3m</p>',keywords:['Cohamy'],keyword_is_new:[true],thumbnail:'',thumbnail_alt:'',schemas:{},nofollow_external:false,nofollow_domains:[],nofollow_exclusions:[]};
for (const locale of ['en_US','vi','vi_VN']) for(const value of [true,false]) {
  try {const result=await analyzeRankMath({...input,locale,keyword_is_new:[value]});assert(result.score>=0&&result.score<=100);console.log(locale,value,result.score);}catch(error){console.error(locale,value,String(error));process.exitCode=1;}
}
