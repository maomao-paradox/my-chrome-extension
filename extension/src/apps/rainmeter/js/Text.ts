/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/rainmeter/js/Text.ts
 * @date 2026-02-05T02:38:01.692Z
 */

/*
_________Class | Text
___Description | Control text input and processing

________Author | sumbioun.com
____Programmer | pedro veneroso

_______Version | 0.1β
__Release date | Oct 24th 2016
___Last update | Oct 25th 2016

_______License |GPLv3 2016 sumbioun.com

*/

export class Text {
	private master: any;
	private number_of_chars: number;
	private current_char: number;
	private current_text: string;
	private text: string[];
	private total_text_length: number;
	private text_array: string[];
	private current_segment: number;
	private max_chars_per_segment: number;
	private text_segments: string[];

	constructor(master: any) {
		this.master = master;
		this.number_of_chars = 0;
		this.current_char = 0;
		this.current_text = '';
		this.text = [];
		this.total_text_length = 0;
		this.text_array = [];
		this.current_segment = 0;
		this.max_chars_per_segment = 50;
		this.text_segments = [];
	}

	public processText(in_text: string): string[] {
		this.resetAll();
		this.text_array = in_text.split('');
		this.text_segments = this.prepareText(in_text);
		this.number_of_chars = this.text_segments[0]?.length || 0;
		if (this.text_segments[0]) {
			this.text = this.text_segments[0].split('');
		}
		this.total_text_length = in_text.length;
		return this.text_segments;
	}

	public resetAll(): void {
		this.number_of_chars = 0;
		this.current_char = 0;
		this.current_text = '';
		this.text = [];
		this.total_text_length = 0;
		this.text_array = [];
		this.current_segment = 0;
		this.text_segments = [];
	}

	public prepareText(in_text: string): string[] {
		const segments: string[] = [];
		const words: string[] = in_text.split(' ');
		let current_segment = '';

		for (let i = 0; i < words.length; i++) {
			if (current_segment.length + words[i].length + 1 <= this.max_chars_per_segment) {
				current_segment += words[i] + ' ';
			} else if (words[i].length > this.max_chars_per_segment) {
				// Se a palavra for muito longa, quebrá-la
				while (words[i].length > 0) {
					const part_length = Math.min(this.max_chars_per_segment - current_segment.length, words[i].length);
					current_segment += words[i].substring(0, part_length);
					words[i] = words[i].substring(part_length);

					if (current_segment.length >= this.max_chars_per_segment || words[i].length === 0) {
						segments.push(current_segment.trim());
						current_segment = '';
					}
				}
			} else {
				segments.push(current_segment.trim());
				current_segment = words[i] + ' ';
			}
		}

		if (current_segment.length > 0) {
			segments.push(current_segment.trim());
		}

		return segments;
	}

	// Método para obter o próximo segmento de texto
	public getNextSegment(): string | null {
		this.current_segment++;
		if (this.current_segment < this.text_segments.length) {
			this.text = this.text_segments[this.current_segment].split('');
			this.number_of_chars = this.text.length;
			this.current_char = 0;
			return this.text_segments[this.current_segment];
		}
		return null;
	}

	// Verifica se existem mais segmentos
	public hasMoreSegments(): boolean {
		return this.current_segment < this.text_segments.length - 1;
	}

	// Atualiza o caractere atual (simulando a digitação)
	public updateChar(): string {
		if (this.current_char < this.number_of_chars) {
			this.current_text += this.text[this.current_char];
			this.current_char++;
			return this.text[this.current_char - 1];
		}
		return '';
	}

	// Verifica se todas as palavras do segmento atual foram processadas
	public isCurrentSegmentComplete(): boolean {
		return this.current_char >= this.number_of_chars;
	}

	// Verifica se todo o texto foi processado
	public isComplete(): boolean {
		return this.current_segment >= this.text_segments.length - 1 && this.current_char >= this.number_of_chars;
	}

	// Obtém o texto completo do segmento atual
	public getCurrentSegment(): string {
		return this.text_segments[this.current_segment] || '';
	}

	// Obtém o texto digitado até o momento
	public getTypedText(): string {
		return this.current_text;
	}
}