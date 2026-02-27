const formatter = new Intl.NumberFormat('fr-FR');

export default function formatNumber(num: number | string) {
    if (typeof num === 'string') num = Number.parseFloat(num);
    return formatter.format(num);
}