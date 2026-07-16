/**
_________Class | Environment
___Description | Controls physics simulation for the environment

________Author | sumbioun.com
____Programmer | pedro veneroso

_______Version | 0.1β
__Release date | Oct 24th 2016
___Last update | Oct 28th 2016

_______License |GPLv3 2016 sumbioun.com

formar palavras, a partir de bd, no fluxo da chuva

*/

export class Environment {
  private basic_font_size: number = 18;
  private basic_mass: number = 1;
  private drop_chars: string[] = ['A','B','C','D','E','F','G','H','I','J','K', 'L', 'M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
  private global_acceleration: number = 0.01;
  private intensity: number;
  private current_intensity: number = 0;
  private windEW: number;
  private windNS: number = 0;
  private time: number = 0.0;
  private current_words_intensity: number = 3;

  constructor() {
    this.intensity = Math.floor(Math.random() * (1200 - 500 + 1)) + 500; // número de caracteres na tela
    this.windEW = Math.random() - 0.5; // negativo para esquerda, positivo para a direita
  }

  public updateCurrentIntensity(): void {
    const update_intensity = Math.floor(Math.random() * (3 - 1 + 1)) + 1;
    if ((this.current_intensity + update_intensity) < this.intensity) {
      this.current_intensity += update_intensity;
    }
  }

  public updateCurrentWind(mouse_x: number): void {
    const transfer_wind = (mouse_x / window.innerWidth) - 0.5;
    this.windEW = transfer_wind;
  }

  public getIntensity(): number {
    return this.intensity;
  }

  public getCurrentIntensity(): number {
    return this.current_intensity;
  }

  public getWind(): number {
    return this.windEW;
  }

  public getChars(): string[] {
    return this.drop_chars;
  }

  /**
     * Retorna a aceleração gravitacional
     * @returns A aceleração gravitacional
    */
  public getGravity(): number {
    return this.global_acceleration;
  }

  public getCurrentWordsIntensity(): number {
    return this.current_words_intensity;
  }

  public initializeCanvas(): void {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('width', Math.floor(window.innerWidth).toString());
    canvas.setAttribute('height', Math.floor(window.innerHeight).toString());
    canvas.id = 'rain_processing';
    document.body.appendChild(canvas);
  }
}