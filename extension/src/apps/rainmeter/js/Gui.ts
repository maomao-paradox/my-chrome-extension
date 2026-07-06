/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/apps/rainmeter/js/Gui.ts
 * @date 2026-02-05T02:38:01.692Z
 */

/*
_________Class | Gui
___Description | Controls creation and manipulation of GUI elements

________Author | sumbioun.com
____Programmer | pedro veneroso

_______Version | 0.1β
__Release date | Oct 24th 2016
___Last update | Oct 28th 2016

_______License |GPLv3 2016 sumbioun.com

*/

import { addElementToDom } from '@/utils/element-control';

export class Gui {
	private master: any;
	private mouse_x: number;
	private mouse_y: number;
	private box_div: HTMLDivElement | null;
	private text_input: HTMLInputElement | null;
	private close_button: HTMLDivElement | null;
	private send_button: HTMLDivElement | null;
	private share_button: HTMLDivElement | null;
	private share_options: HTMLDivElement | null;
	private facebook_button: HTMLDivElement | null;
	private direct_link_button: HTMLDivElement | null;
	private direct_link_text: HTMLInputElement | null;
	private confirm_button: HTMLDivElement | null;
	private info_box: HTMLDivElement | null;

	constructor(master: any) {
		this.master = master;
		this.mouse_x = 0;
		this.mouse_y = 0;
		this.box_div = null;
		this.text_input = null;
		this.close_button = null;
		this.send_button = null;
		this.share_button = null;
		this.share_options = null;
		this.facebook_button = null;
		this.direct_link_button = null;
		this.direct_link_text = null;
		this.confirm_button = null;
		this.info_box = null;

		this.bindEvents();
	}

	private bindEvents(): void {
		document.addEventListener('mousemove', (e: MouseEvent) => this.mouseMove(e));
	}

	private mouseMove(event: MouseEvent): void {
		this.mouse_x = event.clientX;
		this.mouse_y = event.clientY;
	}

	public animateBox(): void {
		if (this.box_div === null) {
			// 使用 addElementToDom 创建并添加 box_div
			const createBoxDiv = addElementToDom({
				tag: 'div',
				style: {
					width: '400px',
					height: '200px',
					position: 'fixed',
					top: '50%',
					left: '50%',
					transform: 'translate(-50%, -50%)',
					borderRadius: '25px',
					backgroundColor: 'rgba(112, 112, 112, 0.8)',
					boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.5)',
					zIndex: '20',
					transition: '0.5s',
					padding: '20px'
				}
			});
			this.box_div = createBoxDiv(document.body) as HTMLDivElement;
		}

		if (this.close_button === null) {
			// 使用 addElementToDom 创建并添加 close_button
			const createCloseButton = addElementToDom({
				tag: 'div',
				style: {
					width: '20px',
					height: '20px',
					position: 'absolute',
					top: '15px',
					right: '15px',
					borderRadius: '50%',
					backgroundColor: 'rgba(255, 255, 255, 0.5)',
					cursor: 'pointer',
					zIndex: '21',
					backgroundImage: 'url(./images/close.png)',
					backgroundSize: 'contain',
					backgroundPosition: 'center',
					backgroundRepeat: 'no-repeat'
				},
				eventlistener: {
					'mouseover': () => this.mouseOver(),
					'mouseout': () => this.mouseOut(),
					'mousedown': () => this.mouseDown()
				}
			});
			this.close_button = createCloseButton(this.box_div) as HTMLDivElement;
		}

		if (this.text_input === null) {
			// 使用 addElementToDom 创建并添加 text_input
			const createTextInput = addElementToDom({
				tag: 'input',
				attrs: {
					type: 'text',
					placeholder: 'Digite sua mensagem...'
				},
				style: {
					width: '320px',
					height: '35px',
					position: 'absolute',
					top: '50%',
					left: '50%',
					transform: 'translate(-50%, -50%)',
					borderRadius: '17px',
					backgroundColor: 'rgba(255, 255, 255, 0.8)',
					border: 'none',
					paddingLeft: '15px',
					paddingRight: '50px',
					fontFamily: 'Arial, sans-serif',
					fontSize: '14px',
					color: '#333',
					zIndex: '19'
				},
				eventlistener: {
					'keypress': (e: KeyboardEvent) => this.keyPress(e)
				}
			});
			this.text_input = createTextInput(this.box_div) as HTMLInputElement;
		}

		if (this.send_button === null) {

			// 使用 addElementToDom 创建并添加 send_button
			const createSendButton = addElementToDom({
				tag: 'div',
				style: {
					width: '40px',
					height: '40px',
					position: 'absolute',
					top: '50%',
					left: '84%',
					transform: 'translate(-50%, -50%)',
					borderRadius: '50%',
					backgroundColor: 'rgba(255, 255, 255, 0.5)',
					cursor: 'pointer',
					zIndex: '21',
					backgroundImage: 'url(./images/send.png)',
					backgroundSize: 'contain',
					backgroundPosition: 'center',
					backgroundRepeat: 'no-repeat'
				},
				eventlistener: {
					'mouseover': () => this.mouseOverSend(),
					'mouseout': () => this.mouseOutSend(),
					'mousedown': () => this.mouseDownSend()
				}
			})
			this.send_button = createSendButton(this.box_div) as HTMLDivElement;

			if (this.share_button === null) {
				// 使用 addElementToDom 创建并添加 share_button
				const createShareButton = addElementToDom({
					tag: 'div',
					style: {
						width: '40px',
						height: '40px',
						position: 'fixed',
						bottom: '20px',
						right: '20px',
						borderRadius: '50%',
						backgroundColor: 'rgba(112, 112, 112, 0.8)',
						cursor: 'pointer',
						zIndex: '21',
						backgroundImage: 'url(./images/share.png)',
						backgroundSize: 'contain',
						backgroundPosition: 'center',
						backgroundRepeat: 'no-repeat',
						boxShadow: '0px 3px 6px rgba(0, 0, 0, 0.5)'
					},
					eventlistener: {
						'mouseover': () => this.mouseOverShare(),
						'mouseout': () => this.mouseOutShare(),
						'mousedown': () => this.mouseDownShare()
					}
				});
				this.share_button = createShareButton(document.body) as HTMLDivElement;
			}
		}
	}

	private mouseOver(): void {
		if (this.close_button) {
			this.close_button.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
		}
	}

	private mouseOut(): void {
		if (this.close_button) {
			this.close_button.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
		}
	}

	private mouseDown(): void {
		if (this.box_div) {
			document.body.removeChild(this.box_div);
			this.box_div = null;
			this.text_input = null;
			this.close_button = null;
			this.send_button = null;
		}
	}

	private mouseOverSend(): void {
		if (this.send_button) {
			this.send_button.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
		}
	}

	private mouseOutSend(): void {
		if (this.send_button) {
			this.send_button.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
		}
	}

	private keyPress(e: KeyboardEvent): void {
		if (e.keyCode === 13) {
			this.mouseDownSend();
		}
	}

	private formatData(data: Date): string {
		return data.getFullYear() + '-' + this.pad(data.getMonth() + 1) + '-' + this.pad(data.getDate()) + ' ' + this.pad(data.getHours()) + ':' + this.pad(data.getMinutes()) + ':' + this.pad(data.getSeconds());
	}

	private pad(n: number): string {
		return (n < 10 ? '0' : '') + n;
	}

	private mouseDownSend(): void {
		if (this.text_input && this.checkInput(this.text_input.value)) {
			if (this.box_div) {
				document.body.removeChild(this.box_div);
				this.box_div = null;
				this.text_input = null;
				this.close_button = null;
				this.send_button = null;
			}

			const currentDate = new Date();
			const dataToSend = {
				'message': this.text_input!.value,
				'timestamp': this.formatData(currentDate)
			};

			// Enviar para API
			const xhr = new XMLHttpRequest();
			xhr.open('POST', 'http://localhost/mria/api/post.php', true);
			xhr.setRequestHeader('Content-Type', 'application/json');

			xhr.onreadystatechange = () => {
				if (xhr.readyState === 4 && xhr.status === 200) {
					const response = JSON.parse(xhr.responseText);
					if (response && response.status === 'success') {
						// Lógica em caso de sucesso
						this.master.startRain(response.id);
					}
				}
			};

			xhr.send(JSON.stringify(dataToSend));
			this.master.startRain('teste'); // Chamada temporária para teste
		} else {
			this.showInfoBox('Por favor, digite uma mensagem com pelo menos 2 caracteres.');
		}
	}

	private mouseOverShare(): void {
		if (this.share_button) {
			this.share_button.style.backgroundColor = 'rgba(112, 112, 112, 1)';
		}
	}

	private mouseOutShare(): void {
		if (this.share_button) {
			this.share_button.style.backgroundColor = 'rgba(112, 112, 112, 0.8)';
		}
	}

	private mouseDownShare(): void {
		this.shareOptions();
	}

	private shareOptions(): void {
		if (this.share_options === null) {
			// 使用 addElementToDom 创建并添加 share_options
			const createShareOptions = addElementToDom({
				tag: 'div',
				style: {
					width: '150px',
					height: '100px',
					position: 'fixed',
					bottom: '70px',
					right: '20px',
					borderRadius: '10px',
					backgroundColor: 'rgba(112, 112, 112, 0.8)',
					zIndex: '20',
					boxShadow: '0px 3px 6px rgba(0, 0, 0, 0.5)'
				}
			});
			this.share_options = createShareOptions(document.body) as HTMLDivElement;

			// Botão do Facebook
			if (this.facebook_button === null) {
				// 使用 addElementToDom 创建并添加 facebook_button
				const createFacebookButton = addElementToDom({
					tag: 'div',
					style: {
						width: '30px',
						height: '30px',
						position: 'absolute',
						top: '15px',
						left: '15px',
						borderRadius: '50%',
						backgroundColor: '#3b5998',
						cursor: 'pointer',
						backgroundImage: 'url(./images/facebook.png)',
						backgroundSize: 'contain',
						backgroundPosition: 'center',
						backgroundRepeat: 'no-repeat'
					},
					eventlistener: {
						'mousedown': () => this.shareFacebook()
					}
				});
				this.facebook_button = createFacebookButton(this.share_options) as HTMLDivElement;
			}

			// Botão do link direto
			if (this.direct_link_button === null) {
				// 使用 addElementToDom 创建并添加 direct_link_button
				const createDirectLinkButton = addElementToDom({
					tag: 'div',
					style: {
						width: '30px',
						height: '30px',
						position: 'absolute',
						bottom: '15px',
						left: '15px',
						borderRadius: '50%',
						backgroundColor: '#4CAF50',
						cursor: 'pointer',
						backgroundImage: 'url(./images/link.png)',
						backgroundSize: 'contain',
						backgroundPosition: 'center',
						backgroundRepeat: 'no-repeat'
					},
					eventlistener: {
						'mousedown': () => this.shareDirectLink()
					}
				});
				this.direct_link_button = createDirectLinkButton(this.share_options) as HTMLDivElement;
			}

			// Fechar opções ao clicar fora
			document.addEventListener('mousedown', (e: MouseEvent) => this.closeShareOptions(e));
		}
	}

	private closeShareOptions(e: MouseEvent): void {
		if (this.share_options && this.share_button && this.facebook_button && this.direct_link_button) {
			const target = e.target as HTMLElement;
			if (target !== this.share_button && target !== this.share_options &&
				target !== this.facebook_button && target !== this.direct_link_button) {
				document.body.removeChild(this.share_options);
				this.share_options = null;
				this.facebook_button = null;
				this.direct_link_button = null;
				document.removeEventListener('mousedown', (e) => this.closeShareOptions(e));
			}
		}
	}

	private shareFacebook(): void {
		// Inicializa o Facebook SDK se necessário
		if (window['FB'] === undefined) {
			this.loadFacebookSDK(() => this.openFacebookShareDialog());
		} else {
			this.openFacebookShareDialog();
		}
	}

	private loadFacebookSDK(callback: () => void): void {
		// 使用 addElementToDom 创建并添加 script 元素
		const createScript = addElementToDom({
			tag: 'script',
			attrs: {
				src: 'https://connect.facebook.net/pt_BR/sdk.js'
			},
			eventlistener: {
				'load': () => {
					window['FB'].init({
						appId: 'SEU_APP_ID_AQUI',
						version: 'v2.12'
					});
					callback();
				}
			}
		});
		createScript(document.body);
	}

	private openFacebookShareDialog(): void {
		const currentUrl = window.location.href;
		window['FB'].ui({
			method: 'share',
			mobile_iframe: true,
			u: currentUrl
		}, (response: any) => {
			// Manipular a resposta
		});
	}

	private shareDirectLink(): void {
		if (this.direct_link_text === null) {
			// 使用 addElementToDom 创建并添加 direct_link_text
			const createDirectLinkText = addElementToDom({
				tag: 'input',
				attrs: {
					type: 'text',
					value: window.location.href
				},
				style: {
					width: '200px',
					height: '30px',
					position: 'fixed',
					bottom: '70px',
					right: '20px',
					borderRadius: '5px',
					border: 'none',
					padding: '5px',
					backgroundColor: 'rgba(255, 255, 255, 0.9)',
					color: '#333',
					zIndex: '22'
				}
			});
			this.direct_link_text = createDirectLinkText(document.body) as HTMLInputElement;

			// Botão de confirmação
			if (this.confirm_button === null) {
				// 使用 addElementToDom 创建并添加 confirm_button
				const createConfirmButton = addElementToDom({
					tag: 'div',
					style: {
						width: '30px',
						height: '30px',
						position: 'fixed',
						bottom: '70px',
						right: '230px',
						borderRadius: '5px',
						backgroundColor: '#4CAF50',
						cursor: 'pointer',
						zIndex: '23',
						backgroundImage: 'url(./images/check.png)',
						backgroundSize: 'contain',
						backgroundPosition: 'center',
						backgroundRepeat: 'no-repeat'
					},
					eventlistener: {
						'mousedown': () => this.confirmReceive()
					}
				});
				this.confirm_button = createConfirmButton(document.body) as HTMLDivElement;
			}

			this.direct_link_text.select();

			// Fechar ao clicar fora
			document.addEventListener('mousedown', (e: MouseEvent) => this.closeDirectLink(e));
		}
	}

	private closeDirectLink(e: MouseEvent): void {
		if (this.direct_link_text && this.confirm_button) {
			const target = e.target as HTMLElement;
			if (target !== this.direct_link_text && target !== this.confirm_button) {
				this.removeDirectLinkElements();
			}
		}
	}

	private removeDirectLinkElements(): void {
		if (this.direct_link_text) {
			document.body.removeChild(this.direct_link_text);
			this.direct_link_text = null;
		}
		if (this.confirm_button) {
			document.body.removeChild(this.confirm_button);
			this.confirm_button = null;
		}
	}

	private confirmReceive(): void {
		this.removeDirectLinkElements();
		this.showInfoBox('Link copiado para a área de transferência!');
	}

	private checkInput(input: string): boolean {
		return input.trim().length >= 2;
	}

	private showInfoBox(message: string): void {
		if (this.info_box === null) {
			// 使用 addElementToDom 创建并添加 info_box
			const createInfoBox = addElementToDom({
				tag: 'div',
				style: {
					position: 'fixed',
					top: '50%',
					left: '50%',
					transform: 'translate(-50%, -50%)',
					padding: '15px',
					backgroundColor: 'rgba(112, 112, 112, 0.9)',
					borderRadius: '10px',
					color: '#fff',
					fontFamily: 'Arial, sans-serif',
					zIndex: '100',
					boxShadow: '0px 3px 6px rgba(0, 0, 0, 0.5)'
				}
			});
			this.info_box = createInfoBox(document.body) as HTMLDivElement;
			this.info_box.textContent = message;

			// Remover após 3 segundos
			setTimeout(() => {
				if (this.info_box) {
					document.body.removeChild(this.info_box);
					this.info_box = null;
				}
			}, 3000);
		}
	}

	public getText(): HTMLInputElement | null {
		return this.text_input;
	}
}