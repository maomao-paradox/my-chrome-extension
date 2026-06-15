/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/rainmeter/js/RainText.ts
 * @date 2026-02-05T02:38:01.692Z
 */

/*
_________Class | RainText
___Description | Controls creation and movement of the rain of characters

________Author | sumbioun.com
____Programmer | pedro veneroso

_______Version | 0.1β
__Release date | Oct 24th 2016
___Last update | Oct 26th 2016

_______License |GPLv3 2016 sumbioun.com

*/

export class RainText {
	private text: string;
	private draw_text: any[];
	private stop_rain: boolean[];
	private continue_rain: boolean;
	private free_text: number[];
	private end_rain: boolean;
	private the_text: string;

	// POSIÇÃO
	private text_x_offset: number[];
	private linear_function: number[][];
	private text_x: number[];
	private text_y: number[];
	private ref_x: number;
	private ref_y: number;
	private min_x: number;
	private max_x: number;
	private min_y: number;
	private max_y: number;
	private origin_x: number;
	private origin_y: number;
	private word_width: number;

	// TEMPO
	private text_timing: number[];
	private min_time: number;
	private max_time: number;
	private current_time: number;
	private count_stop: number;
	private count_time: number;
	private count_free: number;
	private count_end: number;

	// FÍSICA
	private drop_size: number;
	private drop_mass: number;
	private drop_wind: number[];
	private store_drop_wind: number[];
	private drop_speed: number[];
	private store_drop_speed: number[];
	private drop_acceleration: number;
	private deceleration: [boolean, number][];
	private decelerate_when: number[];
	private global_wind: number;
	private gravity: number;

	// CONTEÚDO
	private drop_color: string;
	private highlight_color: string;
	private is_highlighting: boolean[];
	private highlight_timer: number[];

	constructor() {
		this.continue_rain = false;
		this.end_rain = false;
		this.ref_x = window.innerWidth / 2;
		this.ref_y = window.innerHeight / 2;
		this.min_y = 100;
		this.max_y = window.innerHeight - 100;
		this.word_width = 0;
		this.min_time = 1;
		this.max_time = 120;
		this.current_time = 0;
		this.count_stop = 0;
		this.count_time = 200;
		this.count_free = 0;
		this.count_end = 0;
		this.drop_size = 18;
		this.drop_mass = 1;
		this.drop_acceleration = 0;
		this.drop_color = "#ffffff";
		this.highlight_color = "#ffffff";
	}

	public initializeText(in_text: string, in_gravity: number, in_wind: number): void {
		this.text = in_text;
		this.gravity = in_gravity;
		this.global_wind = in_wind;

		this.count_time = 14 * in_text.length;

		this.text_timing = new Array(in_text.length);
		this.text_x = new Array(in_text.length);
		this.text_y = new Array(in_text.length);
		this.draw_text = new Array(in_text.length);
		this.drop_speed = new Array(in_text.length);
		this.drop_wind = new Array(in_text.length);
		this.stop_rain = new Array(in_text.length);
		this.text_x_offset = new Array(in_text.length);
		this.linear_function = new Array(in_text.length);
		this.store_drop_wind = new Array(in_text.length);
		this.store_drop_speed = new Array(in_text.length);
		this.deceleration = new Array(in_text.length);
		this.decelerate_when = new Array(in_text.length);
		this.is_highlighting = new Array(in_text.length);
		this.highlight_timer = new Array(in_text.length);
		
		// 初始化高亮相关属性
		for (let i = 0; i < this.text.length; i++) {
			this.is_highlighting[i] = false;
			this.highlight_timer[i] = 0;
			// 设置默认的高亮颜色为白色
			this.highlight_color = "#ffffff";
		}

		for (let i = 0; i < this.text_timing.length; i++) {
			this.text_x_offset[i] = Math.floor(Math.random() * (35 - 17 + 1)) + 17;
			this.word_width += this.text_x_offset[i];
			this.drop_wind[i] = Math.random() * (0.2 + 0.2) - 0.2;
			this.drop_wind[i] += this.global_wind;
			this.store_drop_wind[i] = this.drop_wind[i];
			this.drop_speed[i] = Math.random() * (1.5 - 0.5) + 0.5;
			this.store_drop_speed[i] = this.drop_speed[i];
			this.stop_rain[i] = false;
			this.deceleration[i] = [false, 0];
			this.decelerate_when[i] = Math.floor(this.drop_speed[i] * 200);
		}

		this.min_x = 100;
		this.max_x = window.innerWidth - this.word_width - 100;
		this.origin_x = Math.floor(Math.random() * (this.max_x - this.min_x + 1)) + this.min_x;
		this.origin_y = Math.floor(Math.random() * (this.max_y - this.min_y + 1)) + this.min_y;

		for (let i = 0; i < this.text_timing.length; i++) {
			this.linearFunction(i);
			this.text_timing[i] = Math.floor(Math.random() * (this.max_time - this.min_time + 1)) + this.min_time;
			this.draw_text[i] = new Array(3);

			this.text_y[i] = Math.floor(Math.random() * (0 + 600 + 1)) - 600;
			this.text_x[i] = this.getStartPosition(i, this.text_y[i]);

			this.draw_text[i][3] = Math.floor(Math.random() * (28 - 12 + 1)) + 12;
		}
	}

	public reinitializeText(): void {
		this.drop_speed = new Array(this.text.length);
		this.drop_wind = new Array(this.text.length);

		for (let i = 0; i < this.text_timing.length; i++) {
			this.drop_wind[i] = this.store_drop_wind[i];
			this.drop_speed[i] = this.store_drop_speed[i];
		}
		this.free_text = new Array(this.text.length);
		for (let n = 0; n < this.text.length; n++) {
			this.free_text[n] = Math.floor(Math.random() * (this.max_time - this.min_time + 1)) + this.min_time;
		}
	}

	public updateText(): void {
		this.count_stop = 0;
		this.count_end = 0;
		for (let i = 0; i < this.text_timing.length; i++) {
			// 处理高亮动画
			if (this.is_highlighting[i]) {
				this.highlight_timer[i]++;
				if (this.highlight_timer[i] > 30) { // 高亮持续30帧
					this.is_highlighting[i] = false;
					this.highlight_timer[i] = 0;
				}
			}
			
			if (this.text_y[i] >= this.origin_y) {
				if (this.continue_rain === false) {
					this.stop_rain[i] = true;
					this.count_stop++;
				}
			}
			if (this.stop_rain[i] === false && this.continue_rain === false) {
				this.text_y[i] += this.drop_speed[i];
				if (this.text_y[i] < (this.origin_y - this.decelerate_when[i])) {
					this.drop_speed[i] += this.gravity;
				} else {
					if (this.deceleration[i][0] === false) {
						this.deceleration[i][1] = (1 * 1 - this.drop_speed[i] * this.drop_speed[i]) / (2 * this.decelerate_when[i]);
						this.deceleration[i][0] = true;
					}
					this.drop_speed[i] += this.deceleration[i][1];
				}
				this.text_x[i] = this.getStartPosition(i, this.text_y[i]);

				this.draw_text[i][0] = this.text_x[i];
				this.draw_text[i][1] = this.text_y[i];
				this.draw_text[i][2] = this.text[i];
				// 添加颜色信息到draw_text
				this.draw_text[i][4] = this.is_highlighting[i] ? this.getHighlightColor(i) : this.drop_color;
			} else if (this.stop_rain[i] === false && this.continue_rain === true) {
				if (this.count_free > this.free_text[i]) {
					this.text_y[i] += this.drop_speed[i];
					this.drop_speed[i] += this.gravity;

					this.text_x[i] = this.getStartPosition(i, this.text_y[i]);

					this.draw_text[i][0] = this.text_x[i];
					this.draw_text[i][1] = this.text_y[i];
					this.draw_text[i][2] = this.text[i];
					// 添加颜色信息到draw_text
					this.draw_text[i][4] = this.is_highlighting[i] ? this.getHighlightColor(i) : this.drop_color;
				}
			}

			if (this.text_y[i] >= window.innerHeight + 200) {
				this.count_end++;
			}
		}
		if (this.count_stop === this.text.length) {
			this.count_time--;
			if (this.count_time <= 0) {
				this.continue_rain = true;
				this.reinitializeText();
				for (let m = 0; m < this.stop_rain.length; m++) {
					this.stop_rain[m] = false;
				}
			}
		}
		this.current_time++;
		if (this.continue_rain) {
			this.count_free++;
		}
		if (this.count_end === this.text.length) {
			this.end_rain = true;
		}
	}

	public getText(): any[] {
		return this.draw_text;
	}

	public echoLine(): (number[] | null)[] {
		const echo: (number[] | null)[] = new Array(this.text_timing.length);
		const iterations: number[] = new Array(this.text_timing.length);
		for (let i = 0; i < this.text_timing.length; i++) {
			if (this.stop_rain[i] === false && this.free_text === undefined) {
				echo[i] = new Array(2);
				iterations[i] = this.drop_speed[i] * 6;

				echo[i][1] = this.text_y[i] - ((this.drop_speed[i] * (iterations[i] - 1)) - Math.pow(this.gravity, iterations[i] - 1));
				echo[i][0] = this.getStartPosition(i, echo[i][1]);
			} else if (this.stop_rain[i] === false && this.count_free > this.free_text[i]) {
				echo[i] = new Array(2);
				iterations[i] = this.drop_speed[i] * 6;
				echo[i][1] = this.text_y[i] - ((this.drop_speed[i] * (iterations[i] - 1)) - Math.pow(this.gravity, iterations[i] - 1));
				echo[i][0] = this.getStartPosition(i, echo[i][1]);
			} else {
				echo[i] = null;
			}
		}
		return echo;
	}

	public linearFunction(in_id: number): void {
		let final_x: number;
		if (in_id === 0) {
			final_x = this.origin_x;
		} else {
			final_x = this.origin_x;
			for (let p = 0; p < in_id; p++) {
				final_x += this.text_x_offset[p];
			}
		}
		const last_x = final_x - this.drop_wind[in_id];
		const final_y = this.origin_y;

		let check_last_position = 0;
		let check_drop_speed = this.drop_speed[in_id];

		while (check_last_position < this.origin_y) {
			check_drop_speed += this.gravity;
			check_last_position += check_drop_speed;
		}
		const last_y = this.origin_y - check_drop_speed;
		this.linear_function[in_id] = [last_x, last_y, final_x, final_y];
	}

	public getStartPosition(in_id: number, in_y: number): number {
		// Função linear para calcular x inicial com base nas coordenadas x e y finais
		const m = (this.linear_function[in_id][3] - this.linear_function[in_id][1]) / (this.linear_function[in_id][2] - this.linear_function[in_id][0]);
		const b = this.linear_function[in_id][3] - (m * this.linear_function[in_id][2]);
		const start_x = (in_y - b) / m;
		return start_x;
	}

	public setText(in_text: string): void {
		this.the_text = in_text;
	}
	
	// 触发字符高亮
	public highlightChar(index: number): void {
		if (index >= 0 && index < this.text.length) {
			this.is_highlighting[index] = true;
			this.highlight_timer[index] = 0;
		}
	}
	
	// 获取高亮颜色（实现渐变效果）
	private getHighlightColor(index: number): string {
		if (!this.is_highlighting[index]) return this.drop_color;
		
		// 计算渐变因子（从亮到暗）
		const factor = 1 - (this.highlight_timer[index] / 30);
		
		// 将白色与原始颜色混合，实现渐变效果
		const r = Math.floor(255 * factor + parseInt(this.drop_color.slice(1, 3), 16) * (1 - factor));
		const g = Math.floor(255 * factor + parseInt(this.drop_color.slice(3, 5), 16) * (1 - factor));
		const b = Math.floor(255 * factor + parseInt(this.drop_color.slice(5, 7), 16) * (1 - factor));
		
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
	}

	public endRainText(): boolean {
		return this.end_rain;
	}
}