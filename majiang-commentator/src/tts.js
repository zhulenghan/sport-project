/**
 * TTS 模块 - macOS say 命令
 * 支持队列，不阻塞解说流程
 */
const { spawn } = require('child_process');

class TTS {
	constructor(lang) {
		this.lang = lang || 'zh';
		this.queue = [];
		this.speaking = false;
	}

	/**
	 * 添加解说到队列
	 */
	speak(text) {
		this.queue.push(text);
		if (!this.speaking) {
			this._processQueue();
		}
	}

	/**
	 * 依次播报队列中的文本
	 */
	_processQueue() {
		if (this.queue.length === 0) {
			this.speaking = false;
			return;
		}
		this.speaking = true;
		const text = this.queue.shift();
		const voice = this.lang === 'zh' ? 'Tingting' : 'Samantha';
		const sayProcess = spawn('say', ['-v', voice, text]);
		let stderr = '';

		sayProcess.stderr.on('data', (chunk) => {
			stderr += chunk.toString();
		});

		sayProcess.on('error', (err) => {
			console.error('[TTS] Speech playback failed:', err.message);
			this._processQueue();
		});

		sayProcess.on('close', (code) => {
			if (code !== 0) {
				console.error('[TTS] Speech playback failed:', stderr.trim() || `say exited with code ${code}`);
			}
			this._processQueue();
		});
	}
}

module.exports = TTS;
