// utils/uid.js

function uid(pattern) {
    // Zestawy znaków
    const digits = '0123456789';
    const lowerLetters = 'abcdefghijkmnpqrstuvwxyz'; // bez l, o
    const upperLetters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // bez O, I
    const lowerHex = 'abcdef';
    const upperHex = 'ABCDEF';

    let result = '';

    for (let char of pattern) {
        switch(char) {
            case 'd':
                result += digits[Math.floor(Math.random() * digits.length)];
                break;
            case 'c':
                result += lowerLetters[Math.floor(Math.random() * lowerLetters.length)];
                break;
            case 'C':
                result += upperLetters[Math.floor(Math.random() * upperLetters.length)];
                break;
            case 'f':
                result += lowerHex[Math.floor(Math.random() * lowerHex.length)];
                break;
            case 'F':
                result += upperHex[Math.floor(Math.random() * upperHex.length)];
                break;
            case 'x':
                // losujemy z d lub c
                const lowerOrDigit = digits + lowerLetters;
                result += lowerOrDigit[Math.floor(Math.random() * lowerOrDigit.length)];
                break;
            case 'X':
                // losujemy z d lub C
                const upperOrDigit = digits + upperLetters;
                result += upperOrDigit[Math.floor(Math.random() * upperOrDigit.length)];
                break;
            case 'h':
                // losujemy z d lub c
                const DigitOrLowerHex = digits + lowerHex;
                result += DigitOrLowerHex[Math.floor(Math.random() * DigitOrLowerHex.length)];
                break;
            case 'H':
                // losujemy z d lub C
                const DigitOrUpperHex = digits + upperHex;
                result += DigitOrUpperHex[Math.floor(Math.random() * DigitOrUpperHex.length)];
                break;
            default:
                // znak dosłowny
                result += char;
        }
    }

    return result;
}

// Eksport funkcji
module.exports = uid;
