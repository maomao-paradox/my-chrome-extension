/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/rainmeter/js/Drops.ts
 * @date 2026-02-05T02:38:01.692Z
 */

/*
_________Class | Drops
___Description | Controls creation and movement of the rain of characters

________Author | sumbioun.com
____Programmer | pedro veneroso

_______Version | 0.1β
__Release date | Oct 24th 2016
___Last update | Oct 25th 2016

_______License |GPLv3 2016 sumbioun.com

*/

export class Drops {
  private id: string | number;
  private init: boolean;
  private drop_size: number;
  private drop_mass: number;
  private drop_wind: number;
  private drop_speed: number;
  private drop_acceleration: number;
  private chars: string[];
  private global_wind: number;
  private gravity: number;
  private drop_char: string;
  private drop_color: string;
  private drop_x: number;
  private drop_y: number;
  private is_highlighting: boolean;
  private highlight_timer: number;

  constructor(in_id: string | number, in_chars: string[], in_gravity: number) {
    this.id = in_id;
    this.init = true;
    this.drop_size = 18; // recebe na criação e atualização
    this.drop_mass = 1; // recebe na criação e atualização
    this.drop_wind = Math.random() * (0.2 + 0.2) - 0.2; // em relação à massa; cálculo de desvio com base na massa
    this.drop_speed = 0;
    this.drop_acceleration = 0;
    this.chars = in_chars;
    this.global_wind = 0;
    this.gravity = in_gravity;
    this.drop_char = '';
    this.drop_color = '#888888'; // 灰色作为默认颜色，不那么亮
    this.drop_x = 0; // recebe na criação e atualização; -100 e +100 em relação à tela
    this.drop_y = 0; // recebe na criação e atualização; -200 a 0 em relação à tela
    this.is_highlighting = false;
    this.highlight_timer = 0;
  }

  public initializeDrop(): void {
    if (this.init === true) {
      this.drop_y = Math.floor(Math.random() * (0 + 600 + 1)) - 600;
    }
    else {
      this.drop_y = Math.floor(Math.random() * (0 + 200 + 1)) - 200;
    }
    this.drop_x = Math.floor(Math.random() * (window.innerWidth - 0 + 1)) + 0;
    this.drop_size = Math.floor(Math.random() * (26 - 8 + 1)) + 8;
    this.drop_speed = Math.random() * (2 - 0.5) + 0.5;
    // this.drop_speed = Math.random() * (1000.5 - 20.5) + 20.5;
    const charIndex = Math.floor(Math.random() * (26 - 1 + 1)) + 1;
    this.drop_char = this.chars[charIndex - 1];
  }

  public updateDrop(in_intensity: number, in_wind: number): void {
    this.drop_y += this.drop_speed;
    this.drop_speed += this.gravity;
    if (this.drop_y > window.innerHeight + 200) {
      this.initializeDrop();
    }

    this.drop_x += in_wind + this.drop_wind;
    this.global_wind = in_wind;
        
    // 更新高亮计时器
    if (this.is_highlighting) {
      this.highlight_timer++;
      // 大约1秒后（假设60fps）恢复正常
      if (this.highlight_timer >= 60) {
        this.is_highlighting = false;
      }
    }
  }

  public getX(): number {
    return this.drop_x;
  }

  public getY(): number {
    return this.drop_y;
  }

  public getSize(): number {
    return this.drop_size;
  }

  public getChar(): string {
    return this.drop_char;
  }
    
  // 获取当前颜色（包括高亮效果）
  public getCurrentColor(): string {
    if (!this.is_highlighting) {
      return this.drop_color;
    }
        
    // 蓝色荧光效果，从亮蓝色渐变回灰色
    const factor = 1 - (this.highlight_timer / 60);
    // 使用蓝色荧光效果：从亮蓝色(#00ffff)渐变到灰色(#888888)
    const r = Math.floor(0 * factor + 136 * (1 - factor));
    const g = Math.floor(255 * factor + 136 * (1 - factor));
    const b = Math.floor(255 * factor + 136 * (1 - factor));
        
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
    
  // 触发高亮效果
  public highlight(): void {
    this.is_highlighting = true;
    this.highlight_timer = 0;
  }

  public echoLine(): number[] {
    const echo: number[] = [];
    const iterations = this.drop_speed * 4;
    echo[0] = this.drop_x - ((this.global_wind + this.drop_wind) * (iterations - 1));
    echo[1] = this.drop_y - ((this.drop_speed * (iterations - 1)) - (this.gravity ^ (iterations - 1)));
    return echo;
  }
}