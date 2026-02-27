export default function Card({ name, value }: Readonly<{ name: string, value: string }>) {
    return (
        <div style={{}}>
            <h1>{name}</h1>
            <p>{value}</p>
        </div>
    )
}