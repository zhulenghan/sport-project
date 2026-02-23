/**
 * TTS 模块 - macOS say 命令
 * 支持队列，不阻塞解说流程
 */
const { exec } = require('child_process');

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
		const escaped = text.replace(/"/g, '\\"');
		const voice = this.lang === 'zh' ? 'Tingting' : 'Samantha';

		exec(`say -v ${voice} "${escaped}"`, (err) => {
			if (err) {
				console.error('[TTS] 播报失败:', err.message);
			}
			this._processQueue();
		});
	}
}

module.exports = TTS;
