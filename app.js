'use strict';
require('dotenv').config({ silent: true });

const express = require('express');
const request = require('request');
const botTelegram = require('node-telegram-bot-api');
const AssistantV1 = require('ibm-watson/assistant/v1');
const port = 8080;
const app = express();
const fs = require('fs');

// for tts, stt
const client_id = 'qzqrzckdb6';
const client_secret = '9XuaJ7GvnX6FCdPHzPwEs7Pg1S7LkU5G0NwC4zfg';
let tagSql = 'select * from tagTb where tag=?';
let context = {}
// let RESULTExample;
let ResultText, rseResult, obj;
let dbTag, watsonRes;
let tag = new Array(10);
let tag_except = new Array(10);
let count = 0;
let count_except = 0;
let singer = null;
let singer_except = null;
let tempId;
let more = null;
let moreThan;
let less = null;
let lessThan;

function saveTag(temp){
	if (count != 9) {
		tag[count] = temp;
		count++;
	}
}

function saveTag_except(temp){
	if (count_except != 9) {
		tag_except[count_except] = temp;
		count_except++;
	}
}

function saveSinger(temp){
	singer = temp;
}

function saveSinger_except(temp){
	singer_except = temp;
}

function searchSimilar(){
	return `
	select n.제목, n.가수, n.노래id 
	from 태그 t, 노래 n 
	where t.노래id=n.노래id 
	and t.태그=(select 태그 
	   from 태그 
	   where 퍼센트=
	   (select max(퍼센트) from 태그 where 노래id=`+tempId+`) 
	   and 노래id=`+tempId+`  limit 1) 
	and n.노래id <>`+tempId+`
	order by 퍼센트 desc order by rand();
	`
}

function searchSimilar2(songTitle){
	return `
	select n.제목, n.가수, n.노래id
	from 태그 t, 노래 n 
	where t.노래id=n.노래id 
	and t.태그=(select 태그 
	   from 태그 t, 노래 n  
	   where 퍼센트=
		  (select max(퍼센트) from 태그 t, 노래 n where n.제목="`+songTitle+`"  and t.노래id=n.노래id )
	   and t.노래id=n.노래id 
	   and n.제목="`+songTitle+`") 
	and n.제목 <> "`+songTitle+`"
	order by 퍼센트 desc order by rand(); 
	`
}

function saveMore(){
	return 'select 퍼센트 from 태그 where 태그="'+more+'" and 노래id="'+tempId+'";';
}

function saveLess(){
	return 'select 퍼센트 from 태그 where 태그="'+less+'" and 노래id="'+tempId+'";';
}

function anySong(){
	return 'select 제목, 가수, 노래id from 노래 order by rand();';
}

function searchTag(){
	let base = 'select n.제목, n.가수, n.노래id from 노래 n, 태그 t where';
	if (singer!=null){
		if (count==0){
			return 'select n.제목, n.가수, n.노래id from 노래 n where n.가수="'+singer+ '" order by rand();';
		}
		//console.log(singer);
		base = base.concat(' n.가수="', singer, '" and');
	}
	if (singer_except!=null){
		if (count==0){
			return 'select n.제목, n.가수, n.노래id from 노래 n where n.가수!="'+singer_except+ '" order by rand();';
		}
		//console.log(singer);
		base = base.concat(' n.가수!="', singer_except, '" and');
	}
	if (count==0)
		return 'select n.제목, n.가수, n.노래id from 노래 n where n.가수="없지롱" order by rand();';
	base = base.concat(' n.노래id in (select 노래id from 태그 where');
	for (let i = 0;i < count;i++) {
		base = base.concat(' 태그= "', tag[i], '")');
		//console.log(tag[i]);
		if (i!=count-1)
			base = base.concat(' and n.노래id in (select 노래id from 태그 where');
	}
	for (let i = 0;i < count_except;i++) {
		//console.log(tag_except[i]);
		base = base.concat(' and n.노래id not in (select 노래id from 태그 where 태그="'+tag_except[i]+'")');
	}
	//console.log(' t.퍼센트>'+moreThan+' and t.태그="' + more + '"');
	if (more != null && tag.includes(more))
		base = base.concat(' and n.노래id=t.노래id and' + 
		' t.퍼센트>'+moreThan+' and t.태그="' + more + '"');
	if (less != null && tag.includes(less))
		base = base.concat(' and n.노래id=t.노래id and' + 
		' t.퍼센트<'+lessThan+' and t.태그="' + less + '"');
	base = base.concat(' group by 노래id order by rand();');
	//console.log(base);
	return base;
}

function init() {
	more = null;
	less = null;
	count = 0;
	count_except = 0;
	singer = null;
	singer_except = null;
	for (let i = 0;i < 10;i++)
		tag[i]=null;
	for (let i = 0;i < 10;i++)
		tag_except[i]=null;
}

// DB
const mysql = require('mysql');
const conn=mysql.createConnection({
	host:'35.188.92.120',
	user:'root',
	password:'xpffprmfoaRlfl123',
	database:'ggiriDB'
});
// DB end

// Assistant
const wAssistant = new AssistantV1({
	version: '2019-02-28',
    username: process.env.ASSISTANT_USERNAME,
    password: process.env.ASSISTANT_PASSWORD, 
	url: process.env.WATSON_URL,
});
console.log(process.env)

function songRecommend(chatId){
	conn.query(searchTag(), function(err, results, fields){
		ResultText = results; // 노래의 결과가 저장됨
		if (err) throw err;
		//console.log('DB result is', ResultText);
		// 응답 : 최대 다섯 개의 노래를 추천해줌
		if(ResultText.length != 0) {
			let reply = watsonRes[0]+"\n";
			let count = 5;
			if (ResultText.length < 5)
				count = ResultText.length;
			for (let i = 0 ; i < count ; i++)
				reply = reply.concat("\n" + ResultText[i].제목 + '-' + ResultText[i].가수);
			// 가장 정확도가 높은 노래는 링크를 함께 보내준다
			reply = reply.concat("\nhttps://music.naver.com/search/search.nhn?query="
				+ ResultText[0].제목 + '-' + ResultText[0].가수);
			telegram.sendMessage(chatId, reply);
			tempId = ResultText[0].노래id;
		}
		else
			telegram.sendMessage(chatId, "그런 노래는 못찾겠어요(ಡ︷ಡ)");
	});
}
// telegram start
const telegram = new botTelegram(process.env.TOKEN_TELEGRAM, { polling: true });

telegram.on('message', (msg) => {
	const chatId = msg.chat.id;
	// 음성 메시지 처리
	console.log('message', msg);
	wAssistant.message({
		workspace_id: process.env.WORKSPACE_ID,
		input: {'text': msg.text},
		context: context
	},(err, response) => {
		if (err)
			console.log('error:', err);
		else {
			context = response.context;
			if(response.output.text[0].includes('|')){ // 태그 구분된 경우
				//console.log(response.output.text[0]);
				watsonRes=response.output.text[0].split('|'); // watson에서 온 응답을 split으로 나눔
				if (watsonRes[1]=='가수'){
					saveSinger(watsonRes[2]);
					songRecommend(chatId);
				}
				else if (watsonRes[1]=='가수제외'){
					saveSinger_except(watsonRes[2]);
					songRecommend(chatId);
				}
				else if (watsonRes[1]=='더') {
					if (!tag.includes(watsonRes[2])){ 
						saveTag(watsonRes[2]);
						songRecommend(chatId);
					}
					// moreThan에 값이 들어가도 비동기/동기 문제로 searchTag를 먼저
					else{
						more = watsonRes[2];
						conn.query(saveMore(), function(err, results, fields){
							ResultText = results;
							if (err)
								throw err;
							if(ResultText.length != 0) {
								moreThan = ResultText[0].퍼센트;
							}
							//console.log("this is more than!!"+moreThan);
							songRecommend(chatId);
						});
					}
				}
				else if (watsonRes[1]=='덜') {
					less = watsonRes[2];
					if (tag.includes(less)){
						conn.query(saveLess(), function(err, results, fields){
							ResultText = results;
							if (err)
								throw err;
							if(ResultText.length != 0) {
								lessThan = ResultText[0].퍼센트;
							}
							//console.log("this is less than!!"+lessThan);
							if (lessThan <= 20){
								let temp = -1;
								for (let i = 0;i < count;i++)
									if (tag[i]==watsonRes[2])
										temp = i;
								for (let i = temp;i < count;i++)
									tag[i]=tag[i+1];
								tag[--count] = null;
							}
							songRecommend(chatId);
						});
					}
					else
						telegram.sendMessage(chatId, "이것보다요? (๑°ㅁ°๑)‼");
				}
				// 비슷 |최근, 비슷|[노래제목]
				else if(watsonRes[1]=='비슷'){
					if(watsonRes[2]=='최근'){
						conn.query(searchSimilar(), function(err, results, fields){
							ResultText = results;
							if (err) throw err;
							//console.log('DB result is', ResultText);
							if(ResultText.length != 0) {
								let reply = watsonRes[0]+"\n";
								let count = 5;
								if (ResultText.length < 5)
									count = ResultText.length;
								for (let i = 0 ; i < count ; i++)
									reply = reply.concat("\n" + ResultText[i].제목 + '-' + ResultText[i].가수);
								reply = reply.concat("\nhttps://music.naver.com/search/search.nhn?query="
									+ ResultText[0].제목 + '-' + ResultText[0].가수);
								telegram.sendMessage(chatId, reply);
								tempId = ResultText[0].노래id;
							}
							else
								telegram.sendMessage(chatId, "그런 노래는 못찾겠어요(´｡•_•｡`)");
						});
					}
					else{// 노래 제목이 오는 경우
						conn.query(searchSimilar2(watsonRes[2]), function(err, results, fields){
							ResultText = results;
							if (err) throw err;
							//console.log('DB result is', ResultText);
							if(ResultText.length != 0) {
								let reply = watsonRes[0]+"\n";
								let count = 5;
								if (ResultText.length < 5)
									count = ResultText.length;
								for (let i = 0 ; i < count ; i++)
									reply = reply.concat("\n" + ResultText[i].제목 + '-' + ResultText[i].가수);
								reply = reply.concat("\nhttps://music.naver.com/search/search.nhn?query="
									+ ResultText[0].제목 + '-' + ResultText[0].가수);
								telegram.sendMessage(chatId, reply);
								tempId = ResultText[0].노래id;
							}
							else
								telegram.sendMessage(chatId, "그런 노래는 못찾겠어요(´｡•_•｡`)");
						});
					}
				}
				else if(watsonRes[1]=='최근'){
					conn.query(
						`select 제목, 가수
						from 노래 
						where 노래id=`+tempId+`;
						`, function(err, results, fields){
							ResultText = results;
							if (err) throw err;
							//console.log('DB result is', ResultText);
							if(ResultText.length != 0) {
								let reply = watsonRes[0]+"\n";
								let count = 5;
								if (ResultText.length < 5)
								count = ResultText.length;
								for (let i = 0 ; i < count ; i++)
									reply = reply.concat("\n" + ResultText[i].제목 + '-' + ResultText[i].가수);
								reply = reply.concat("\nhttps://music.naver.com/search/search.nhn?query="
									+ ResultText[0].제목 + '-' + ResultText[0].가수);
								telegram.sendMessage(chatId, reply);
								tempId = ResultText[0].노래id;
						 	}
							else
								telegram.sendMessage(chatId, "그런 노래는 못찾겠어요(´｡•_•｡`)");
					});
				}
				else if(watsonRes[1]=='아무무'){
					conn.query(anySong(), function(err, results, fields){
							ResultText = results;
							if (err) throw err;
							//console.log('DB result is', ResultText);
							if(ResultText.length != 0) {
								let reply = watsonRes[0]+"\n";
								let count = 5;
								if (ResultText.length < 5)
								count = ResultText.length;
								for (let i = 0 ; i < count ; i++)
									reply = reply.concat("\n" + ResultText[i].제목 + '-' + ResultText[i].가수);
								reply = reply.concat("\nhttps://music.naver.com/search/search.nhn?query="
									+ ResultText[0].제목 + '-' + ResultText[0].가수);
								telegram.sendMessage(chatId, reply);
								tempId = ResultText[0].노래id;
						 	}
							else
								telegram.sendMessage(chatId, "그런 노래는 못찾겠어요(´｡•_•｡`)");
					});
				}
				else if(watsonRes[1]=='제외'){
					if(!tag_except.includes(watsonRes[2]))
						saveTag_except(watsonRes[2]);
					songRecommend(chatId);
				}
				else {
					if(!tag.includes(watsonRes[1]))
						saveTag(watsonRes[1]);
					songRecommend(chatId);
				}
			}
			// | 에 else
			else {
				telegram.sendMessage(chatId, response.output.text[0]);
				init();
			}
		}
	});
});

// TTS - [ipaddress]/tts에 들어갔을 때 음성이 나옴
// app.get('/tts', function(req, res) {
// 	var api_url = 'https://naveropenapi.apigw.ntruss.com/voice/v1/tts';
// 	var request = require('request');
// 	var options = {
// 	  url: api_url,
// 	  form: { speaker: 'mijin', speed: '0', text: String(RESULTExample)}, // result를 여기에 넣어 tts
// 	  headers: { 'X-NCP-APIGW-API-KEY-ID': client_id, 'X-NCP-APIGW-API-KEY': client_secret },
// 	};
// 	var writeStream = fs.createWriteStream('./audio/tts1.mp3'); // tts1.mp3 파일 생성
// 	var _req = request.post(options).on('response', function(response) {
// 	  console.log(response.statusCode); // 200
// 	  console.log(response.headers['content-type']);
// 	});
// 	_req.pipe(writeStream); // file로 출력
// 	_req.pipe(res); // 브라우저로 출력
// });


//스피커를 사용했을 때 - 대답해줄 때 왓슨에서 받은 내용을 tts
//스피커에 말을 할 때 해당 내용을 stt


// function tts(){//req, res) {
// 	var api_url = 'https://naveropenapi.apigw.ntruss.com/voice/v1/tts';
// 	var request = require('request');
// 	var options = {
// 		url: api_url,
// 		form: { speaker: 'mijin', speed: '0', text: String("좋은")}, // result를 여기에 넣어 tts
// 		headers: { 'X-NCP-APIGW-API-KEY-ID': client_id, 'X-NCP-APIGW-API-KEY': client_secret },
// 	};
// 	var writeStream = fs.createWriteStream('./audio/tts1.mp3'); // tts1.mp3 파일 생성
// 	var _req = request.post(options).on('response', function(response) {
// 		console.log(response.statusCode); // 200
// 		console.log(response.headers['content-type']);
// 	});
// 	_req.pipe(writeStream); // file로 출력
// 	//_req.pipe(res); // 브라우저로 출력
// }

// STT
// function stt(language, filePath) {
//     const url = `https://naveropenapi.apigw.ntruss.com/recog/v1/stt?lang=${language}`;
//     const requestConfig = {
//         url: url,
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/octet-stream',
//             'X-NCP-APIGW-API-KEY-ID': client_id,
//             'X-NCP-APIGW-API-KEY': client_secret
//         },
//         body: fs.createReadStream(filePath)
//     };

//     request(requestConfig, (err, response, body) => {
//         if (err) {
//             console.log(err);
//             return;
//         }

//         //console.log(response.statusCode);
//         //console.log(body);
//         obj = JSON.parse(body).text;
//         console.log("body is " + obj);
//     });
// }

// tts();
// stt('Kor', './audio/tts1.mp3'); // tts1.mp3의 음성을 읽어 obj에 저장

// 실행
app.listen(port, function(req, res) {
	console.log(`Use localhost:${port} on the browser to check the server`);
});
