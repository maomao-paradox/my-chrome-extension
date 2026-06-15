class Dandelion {
    constructor() {
        this.dandelion = document.getElementById('dandelion');
        this.seeds = document.querySelectorAll('.seed');
        this.isClicked = false;
        this.init();
    }

    init() {
        this.dandelion.addEventListener('click', () => this.handleClick());
        this.dandelion.addEventListener('mouseenter', () => this.handleMouseEnter());
        this.dandelion.addEventListener('mouseleave', () => this.handleMouseLeave());
    }

    handleMouseEnter() {
        if (!this.isClicked) {
            this.dandelion.style.animation = 'sway 1s ease-in-out infinite';
        }
    }

    handleMouseLeave() {
        this.dandelion.style.animation = '';
    }

    handleClick() {
        if (this.isClicked) return;
        this.isClicked = true;
        
        this.dandelion.style.animation = '';
        
        this.seeds.forEach((seed, index) => {
            const angle = (index * 24) * (Math.PI / 180);
            const distance = 250 + Math.random() * 250;
            const rotation = 1 + Math.random() * 4;
            
            const tx = Math.cos(angle) * distance + (Math.random() - 0.5) * 100;
            const ty = -Math.abs(Math.sin(angle) * distance) - 150 - Math.random() * 200;
            
            seed.style.setProperty('--tx', `${tx}px`);
            seed.style.setProperty('--ty', `${ty}px`);
            seed.style.setProperty('--rotation', rotation);
            
            setTimeout(() => {
                seed.classList.add('flying');
            }, index * 50);
        });
        
        setTimeout(() => {
            this.reset();
        }, 4000);
    }

    reset() {
        this.seeds.forEach(seed => {
            seed.classList.remove('flying');
            seed.style.setProperty('--tx', '300px');
            seed.style.setProperty('--ty', '-300px');
            seed.style.setProperty('--rotation', '1');
        });
        this.isClicked = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Dandelion();
});