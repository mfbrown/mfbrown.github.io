// Split-flap display animation with randomization
document.addEventListener('DOMContentLoaded', function() {
  const flipLetters = document.querySelectorAll('.flip-letter');
  const baseDelay = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--base-delay')) || 0;
  
  flipLetters.forEach((letter, index) => {
    const finalChar = letter.getAttribute('data-char');
    // Check if this is an article page (post-title-container exists)
    const isArticlePage = document.querySelector('.post-title-container') !== null;
    
    // Shorter animation for article pages with slower flip rate
    const numFlips = isArticlePage 
      ? Math.floor(Math.random() * 5) + 8  // 8-12 letters for articles
      : Math.floor(Math.random() * 10) + 15; // 15-25 letters for home
    const duration = isArticlePage
      ? 1.2 + Math.random() * 0.4  // 1.2-1.6 seconds for articles (slower rate)
      : 1.5 + Math.random() * 0.8; // 1.5-2.3 seconds for home
    const existingDelay = letter.style.animationDelay || '0s';
    
    // Generate random sequence of letters
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let letterSequence = '';
    
    for (let i = 0; i < numFlips; i++) {
      const randomIndex = Math.floor(Math.random() * alphabet.length);
      letterSequence += alphabet[randomIndex];
    }
    
    // Add final character at the end
    letterSequence += finalChar;
    
    // Create custom animation keyframes for the letter cycling
    const animationName = `cycleLetter-${Math.random().toString(36).substr(2, 9)}`;
    const flipAnimationName = `flipLetter-${Math.random().toString(36).substr(2, 9)}`;
    
    let keyframes = `@keyframes ${animationName} {\n`;
    
    for (let i = 0; i < letterSequence.length; i++) {
      const percentage = (i / (letterSequence.length - 1) * 100).toFixed(2);
      keyframes += `  ${percentage}% { content: '${letterSequence[i]}'; }\n`;
    }
    
    keyframes += '}';
    
    // Create synchronized flip animation with smooth rotation
    let flipKeyframes = `@keyframes ${flipAnimationName} {\n`;
    
    for (let i = 0; i < letterSequence.length; i++) {
      const percentage = (i / (letterSequence.length - 1) * 100);
      const flipStart = Math.max(0, percentage - 25);
      const flipMid = percentage;
      const flipEnd = Math.min(100, percentage + 25);
      
      if (i === 0) {
        flipKeyframes += `  0% { transform: translate(-50%, -50%) rotateX(0deg); }\n`;
      }
      
      // Smooth flip motion around each letter change (leisurely pace)
      flipKeyframes += `  ${flipStart.toFixed(2)}% { transform: translate(-50%, -50%) rotateX(0deg); }\n`;
      flipKeyframes += `  ${flipMid.toFixed(2)}% { transform: translate(-50%, -50%) rotateX(180deg); }\n`;
      flipKeyframes += `  ${flipEnd.toFixed(2)}% { transform: translate(-50%, -50%) rotateX(360deg); }\n`;
    }
    
    flipKeyframes += '  100% { transform: translate(-50%, -50%) rotateX(360deg); }\n}';
    
    // Create styles for the specific letter's ::before pseudo-element
    const letterClass = `flip-letter-${Math.random().toString(36).substr(2, 9)}`;
    letter.classList.add(letterClass);
    
    const styles = `
      ${keyframes}
      ${flipKeyframes}
      
      .${letterClass}::before {
        animation: ${animationName} ${duration}s steps(1) forwards, ${flipAnimationName} ${duration}s linear forwards;
        animation-delay: ${existingDelay};
      }
    `;
    
    // Inject the styles into the page
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  });
});

