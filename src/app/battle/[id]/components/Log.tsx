import { Round } from "../../../../../models/Hit";
import LogItem from "./LogItem";

export default function Log({hits}: {hits: Round[]}) {
    return (
        <div>
            {hits && hits.map(hit => <LogItem key={hit.block_height} hit={hit} />)}
        </div>
    )
}
