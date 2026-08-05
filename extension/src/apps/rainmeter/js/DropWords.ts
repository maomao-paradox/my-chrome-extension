/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/rainmeter/js/DropWords.ts
 * @date 2026-02-05T02:38:01.691Z
 */

/*
_________Class | DropWords
___Description | Controls creation and movement of the rain of words

________Author | sumbioun.com
____Programmer | pedro veneroso

_______Version | 0.1β
__Release date | Oct 28th 2016
___Last update | Oct 28th 2016

_______License |GPLv3 2016 sumbioun.com

*/

export class DropWords {
  private text: string;
  private draw_text: any[];
  private stop_rain: boolean[];
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
  private count_end: number;

  // FÍSICA
  private drop_size: number;
  private drop_mass: number;
  private drop_wind: number[];
  private drop_speed: number[];
  private drop_acceleration: number;
  private global_wind: number;
  private gravity: number;
  private standard_time: any;
  private test_counter: number;

  constructor() {
    this.end_rain = false;
    this.ref_x = window.innerWidth / 2;
    this.ref_y = window.innerHeight / 2;
    this.min_y = 100;
    this.max_y = window.innerHeight - 100;
    this.word_width = 0;
    this.min_time = 1;
    this.max_time = 400;
    this.current_time = 0;
    this.count_end = 0;
    this.drop_size = 18;
    this.drop_mass = 1;
    this.drop_acceleration = 0;
    this.test_counter = 0;
  }

  public initializeText(in_text: string, in_gravity: number, in_wind: number): void {
    this.text = in_text;
    this.gravity = in_gravity;
    this.global_wind = in_wind;

    this.text_timing = new Array(in_text.length);
    this.text_x = new Array(in_text.length);
    this.text_y = new Array(in_text.length);
    this.draw_text = new Array(in_text.length);
    this.drop_speed = new Array(in_text.length);
    this.drop_wind = new Array(in_text.length);
    this.stop_rain = new Array(in_text.length);
    this.text_x_offset = new Array(in_text.length);
    this.linear_function = new Array(in_text.length);

    this.min_x = 100;
    this.word_width = this.text_timing.length * 25;
    this.max_x = window.innerWidth - this.word_width - 100;
    this.origin_x = Math.floor(Math.random() * (this.max_x - this.min_x + 1)) + this.min_x;
    this.origin_y = Math.floor(Math.random() * (this.max_y - this.min_y + 1)) + this.min_y;

    for (let i = 0; i < this.text_timing.length; i++) {
      this.text_timing[i] = Math.floor(Math.random() * (this.max_time - this.min_time + 1)) + this.min_time;
      this.text_x_offset[i] = Math.floor(Math.random() * (35 - 17 + 1)) + 17;
      this.word_width += this.text_x_offset[i];
      this.drop_wind[i] = Math.random() * (0.2 + 0.2) - 0.2;
      this.drop_wind[i] += this.global_wind;

      this.text_y[i] = Math.floor(Math.random() * (0 + 200 + 1)) - 200;
      if (i > 0) {
        this.drop_speed[i] = this.getStartSpeed(i);
      } else {
        this.drop_speed[i] = Math.random() * (0.8 - 0.5) + 0.5;
      }

      this.linearFunction(i);

      this.draw_text[i] = new Array(3);
      this.text_x[i] = this.getStartPosition(i, this.text_y[i]);
      this.draw_text[i][3] = Math.floor(Math.random() * (28 - 12 + 1)) + 12;
    }
  }

  public updateText(): void {
    this.count_end = 0;
    for (let i = 0; i < this.text_timing.length; i++) {
      this.text_y[i] += this.drop_speed[i];
      this.drop_speed[i] += this.gravity;

      this.text_x[i] = this.getStartPosition(i, this.text_y[i]);

      this.draw_text[i][0] = this.text_x[i];
      this.draw_text[i][1] = this.text_y[i];
      this.draw_text[i][2] = this.text[i];

      if (this.text_y[i] >= window.innerHeight + 200) {
        this.count_end++;
      }
      if (this.count_end === this.text.length) {
        this.end_rain = true;
      }
    }
  }

  public getText(): any[] {
    return this.draw_text;
  }

  public echoLine(): number[][] {
    const echo: number[][] = new Array(this.text_timing.length);
    const iterations: number[] = new Array(this.text_timing.length);
    for (let i = 0; i < this.text_timing.length; i++) {
      echo[i] = new Array(2);
      iterations[i] = this.drop_speed[i] * 6;

      echo[i][1] = this.text_y[i] - ((this.drop_speed[i] * (iterations[i] - 1)) - Math.pow(this.gravity, iterations[i] - 1));
      echo[i][0] = this.getStartPosition(i, echo[i][1]);
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

  public getStartSpeed(current_id: number): number {
    const reference_start_y = this.text_y[0];
    let reference_drop_speed = this.drop_speed[0];
    const current_timing = this.text_timing[current_id];
    const current_start_y = this.text_y[current_id];

    let reference_y = reference_start_y;
    let iterations = 0;
    while (reference_y < this.origin_y) {
      reference_y += reference_drop_speed;
      reference_drop_speed += this.gravity;
      iterations++;
    }
    iterations -= 1;

    const current_speed = (this.origin_y - this.text_y[current_id] - (((this.gravity * iterations) + this.gravity) * (iterations / 2))) / iterations;
    return current_speed;
  }

  public endRainText(current_id?: number): boolean {
    return this.end_rain;
  }
}