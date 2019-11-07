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
let count = 0;
let singer = null;
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

function saveSinger(temp){
	singer = temp;
}

function saveMore(){
	return 'select 퍼센트 from 태그 where 태그="'+more+'" and 노래id="'+tempId+'";';
}

function saveLess(){
	return 'select 퍼센트 from 태그 where 태그="'+less+'" and 노래id="'+tempId+'";';
}

function searchTag(){
	let base = 'select 제목, 가수, n.노래id from 노래 n, 태그 t where';
	if (singer!=null)
		base.concat(' 가수="', singer, '" and');
	base = base.concat(' n.노래id in (select 노래id from 태그 where');
	for (let i = 0;i < count;i++) {
		base = base.concat(' 태그= "', tag[i],'")');
		console.log(tag[i]);
		if (i!=count-1)
			base = base.concat(' and n.노래id in (select 노래id from 태그 where');
	}
	console.log(' t.퍼센트>'+moreThan+' and t.태그="' + more + '"');
	if (more != null && tag.includes(more))
		base = base.concat(' and n.노래id=t.노래id and' + 
		' t.퍼센트>'+moreThan+' and t.태그="' + more + '"');
	if (less != null && tag.includes(less))
		base = base.concat(' and n.노래id=t.노래id and' + 
		' t.퍼센트<'+lessThan+' and t.태그="' + less + '"');
	base = base.concat(' group by 노래id;');
	return base;
}

function init(){
	more = null;
	less = null;
	count = 0;
	singer = null;
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

const telegram = new botTelegram(process.env.TOKEN_TELEGRAM, { polling: true });

// Telegram
telegram.on('message', (msg) => {
	const chatId = msg.chat.id;	
	console.log('message', msg);
	fs.writeFileSync('hello.m4a', msg.audio);

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
				//messageSplitDB(response.output.text[0]);

				watsonRes=response.output.text[0].split('|'); // watson에서 온 응답을 split으로 나눔
				if (watsonRes[1]=='가수')
					saveSinger(watsonRes[2]);
				else if (watsonRes[1]=='더') {
					more = watsonRes[2];
					if (!tag.includes(more))
						saveTag(more);
					else
						conn.query(saveMore(), function(err, results, fields){
							ResultText = results;
							if (err)
								throw err;
							if(ResultText != undefined) {
								moreThan = ResultText[0].퍼센트;
							}
							console.log(moreThan);
						});
				}
				else if (watsonRes[1]=='덜') {
					less = watsonRes[2];
					if (tag.includes(less))
						conn.query(saveLess(), function(err, results, fields){
							ResultText = results;
							if (err)
								throw err;
							if(ResultText != undefined) {
								lessThan = ResultText[0].퍼센트;
							}
							console.log(lessThan);
						});
				}
				else {
					saveTag(watsonRes[1]);
				}
				console.log('더'+more);
				console.log('덜'+less);
				conn.query(searchTag(), function(err, results, fields){
					ResultText = results; // 노래의 결과가 저장됨
					if (err)
						throw err;
					console.log('DB result is', ResultText);
					if(ResultText != undefined) {
						let reply;
						reply = watsonRes[0];
						let count = 5;
						if (ResultText.length < 5)
							count = ResultText.length;
						for (let i=0;i < count;i++){
							reply = reply.concat("\n" + ResultText[i].제목 + '-' + ResultText[i].가수);
						}
						reply = reply.concat("\nhttps://music.naver.com/search/search.nhn?query="
							+ ResultText[0].제목 + '-' + ResultText[0].가수);
						telegram.sendMessage(chatId, reply);
						tempId = ResultText[0].노래id;
					}
					else
						telegram.sendMessage(chatId, "결과가 없어요ㅜ");
				});
				//messageSplitDB("hello;sad");
				// // 처음에 undefined가 나옴 - 두 번째 request에서부터! sync문제인듯
			}
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


function tts(){//req, res) {
	var api_url = 'https://naveropenapi.apigw.ntruss.com/voice/v1/tts';
	var request = require('request');
	var options = {
		url: api_url,
		form: { speaker: 'mijin', speed: '0', text: String("좋은")}, // result를 여기에 넣어 tts
		headers: { 'X-NCP-APIGW-API-KEY-ID': client_id, 'X-NCP-APIGW-API-KEY': client_secret },
	};
	var writeStream = fs.createWriteStream('./audio/tts1.mp3'); // tts1.mp3 파일 생성
	var _req = request.post(options).on('response', function(response) {
		console.log(response.statusCode); // 200
		console.log(response.headers['content-type']);
	});
	_req.pipe(writeStream); // file로 출력
	//_req.pipe(res); // 브라우저로 출력
}

// STT
function stt(language, filePath) {
    const url = `https://naveropenapi.apigw.ntruss.com/recog/v1/stt?lang=${language}`;
    const requestConfig = {
        url: url,
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'X-NCP-APIGW-API-KEY-ID': client_id,
            'X-NCP-APIGW-API-KEY': client_secret
        },
        body: fs.createReadStream(filePath)
    };

    request(requestConfig, (err, response, body) => {
        if (err) {
            console.log(err);
            return;
        }

        //console.log(response.statusCode);
        //console.log(body);
        obj = JSON.parse(body).text;
        console.log("body is " + obj);
    });
}

//tts();
//stt('Kor', './audio/tts1.mp3'); // tts1.mp3의 음성을 읽어 obj에 저장

// 실행
app.listen(port, function(req, res) {
	console.log(`Use localhost:${port} on the browser to check the server`);
});

// 'use strict';
// require('dotenv').config({ silent: true });

// var express = require('express');
// const request = require('request');
// const botTelegram = require('node-telegram-bot-api');
// const AssistantV1 = require('ibm-watson/assistant/v1');

// var app = express();
// var client_id = 'qzqrzckdb6';
// var client_secret = '9XuaJ7GvnX6FCdPHzPwEs7Pg1S7LkU5G0NwC4zfg';
// var fs = require('fs');

// const port = 8080;
// let context = {}
// let RESULTExample;
// let ResultText, obj;

// // DB
// const mysql = require('mysql');
// const conn=mysql.createConnection({
// 	host:'101.101.160.73',
// 	user:'root',
// 	password:'xpffprmfoaRlfl123',
// 	database:'song'
// });
// conn.connect();

// conn.query('select * from ex', function(err, results, fields){
// 	ResultText = results;
// 	if (err) throw err;
// 	console.log('The result is',ResultText[0].title);
// });

// conn.end();
// // DB end

// // Assistant
// const wAssistant = new AssistantV1({
// 	version: '2019-02-28',
//     username: process.env.ASSISTANT_USERNAME,
//     password: process.env.ASSISTANT_PASSWORD, 
// 	url: process.env.WATSON_URL,
// });
// console.log(process.env)

// const telegram = new botTelegram(process.env.TOKEN_TELEGRAM, { polling: true });

// // Telegram
// telegram.on('message', (msg) => {
// 	const chatId = msg.chat.id;	
// 	console.log('message', msg.text);

// 	wAssistant.message({
// 		workspace_id: process.env.WORKSPACE_ID,
// 		input: {'text': msg.text},
// 		context: context
// 	},(err, response) => {
// 		if (err)
// 			console.log('error:', err);
// 		else {
// 			context = response.context;
// 			telegram.sendMessage(chatId, response.output.text[0]+ResultText[0].title); // 답장
// 			RESULTExample = response.output.text[0]+ResultText[0].title;
// 		}
// 	});
// });

// // TTS - [ipaddress]/tts에 들어갔을 때 음성이 나옴
// // app.get('/tts', function(req, res) {
// // 	var api_url = 'https://naveropenapi.apigw.ntruss.com/voice/v1/tts';
// // 	var request = require('request');
// // 	var options = {
// // 	  url: api_url,
// // 	  form: { speaker: 'mijin', speed: '0', text: String(RESULTExample)}, // result를 여기에 넣어 tts
// // 	  headers: { 'X-NCP-APIGW-API-KEY-ID': client_id, 'X-NCP-APIGW-API-KEY': client_secret },
// // 	};
// // 	var writeStream = fs.createWriteStream('./audio/tts1.mp3'); // tts1.mp3 파일 생성
// // 	var _req = request.post(options).on('response', function(response) {
// // 	  console.log(response.statusCode); // 200
// // 	  console.log(response.headers['content-type']);
// // 	});
// // 	_req.pipe(writeStream); // file로 출력
// // 	_req.pipe(res); // 브라우저로 출력
// // });

// function tts(){//req, res) {
// 	var api_url = 'https://naveropenapi.apigw.ntruss.com/voice/v1/tts';
// 	var request = require('request');
// 	var options = {
// 	  url: api_url,
// 	  form: { speaker: 'mijin', speed: '0', text: String("좋은 하루야")}, // result를 여기에 넣어 tts
// 	  headers: { 'X-NCP-APIGW-API-KEY-ID': client_id, 'X-NCP-APIGW-API-KEY': client_secret },
// 	};
// 	var writeStream = fs.createWriteStream('./audio/tts1.mp3'); // tts1.mp3 파일 생성
// 	var _req = request.post(options).on('response', function(response) {
// 	  console.log(response.statusCode); // 200
// 	  console.log(response.headers['content-type']);
// 	});
// 	_req.pipe(writeStream); // file로 출력
// 	//_req.pipe(res); // 브라우저로 출력
// }

// // STT
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
// //stt('Kor', './audio/tts1.mp3'); // tts1.mp3의 음성을 읽어 obj에 저장

// // 실행
// app.listen(port, function(req, res) {
//   console.log(`Use localhost:${port} on the browser to check the server`);
// });
