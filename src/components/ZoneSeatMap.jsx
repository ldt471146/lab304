export default function ZoneSeatMap({
  seats,
  selectedSeat,
  onSelect,
  occupiedKey = 'occupied',
  onOccupiedClick,
}) {
  const zones = {}
  seats.forEach(s => {
    const zk = `${s.zone_row}-${s.zone_col}`
    if (!zones[zk]) zones[zk] = { zone_row: s.zone_row, zone_col: s.zone_col, seats: [] }
    zones[zk].seats.push(s)
  })
  const sortedZones = Object.values(zones).sort((a, b) => a.zone_row - b.zone_row || a.zone_col - b.zone_col)

  const ZONE_NAMES = { '1-1': 'A区', '1-2': 'B区', '2-1': 'C区', '2-2': 'D区' }

  return (
    <div className="seat-map">
      <div className="zone-grid">
        {sortedZones.map(zone => {
          const zk = `${zone.zone_row}-${zone.zone_col}`
          return (
            <div key={zk} className="zone-block">
              <div className="zone-label">{ZONE_NAMES[zk] || `区${zone.zone_row}${zone.zone_col}`}</div>
              <div className="zone-seats">
                {zone.seats
                  .sort((a, b) => a.row_label.localeCompare(b.row_label) || a.col_number - b.col_number)
                  .map(seat => {
                    const occupied = seat[occupiedKey]
                    const seatId = seat.seat_id ?? seat.id
                    const mine = selectedSeat === seatId
                    const canClickOccupied = occupied && typeof onOccupiedClick === 'function'
                    return (
                      <button
                        key={seatId}
                        className={`seat ${occupied ? 'occupied' : ''} ${canClickOccupied ? 'occupied-clickable' : ''} ${mine ? 'selected' : ''}`}
                        onClick={() => {
                          if (occupied) {
                            if (canClickOccupied) onOccupiedClick(seat)
                            return
                          }
                          onSelect(mine ? null : seatId)
                        }}
                        title={occupied ? (seat.occupiedTitle || '已占用') : seat.seat_number}
                        disabled={occupied && !canClickOccupied}
                      >
                        {seat.seat_number}
                      </button>
                    )
                  })}
              </div>
            </div>
          )
        })}
      </div>
      <div className="seat-legend">
        <span><span className="legend-dot available" /> 空闲</span>
        <span><span className="legend-dot occupied" /> 已占</span>
        <span><span className="legend-dot selected" /> 已选</span>
      </div>
    </div>
  )
}
