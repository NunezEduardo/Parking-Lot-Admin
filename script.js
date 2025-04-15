class ParkingSystem {
    constructor() {
        this.spots = [];
        this.cars = [];
        this.ticketCounter = 1;
        this.zones = ['A', 'B', 'C', 'D', 'E'];
        this.parkingRate = 1.4; // Tarifa por vehículo en dólares
        this.totalRevenue = 0; // Ingresos totales
        this.revenueByZone = {}; // Ingresos por zona
        this.zones.forEach(zone => this.revenueByZone[zone] = 0);
        this.trafficLevels = {
            horizontal: Array(5).fill('low'),
            vertical: Array(4).fill('low')
        };
        this.charts = {}; // Almacenar las instancias de las gráficas
        this.maintenanceStatus = {
            gates: {
                'E1': false,
                'E2': false,
                'S1': false,
                'S2': false
            },
            streets: {
                horizontal: Array(5).fill(false),
                vertical: Array(4).fill(false)
            },
            zones: Object.fromEntries(this.zones.map(zone => [zone, false])),
            spots: {}
        };
        this.targetOccupancyRange = {
            min: 0.5, // 50% ocupación mínima
            max: 0.9  // 90% ocupación máxima
        };
        this.initializeLayout();
        this.setupEventListeners();
    }

    initializeCharts() {
        // Configuración común para todas las gráficas
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#e0e0e0'
                    }
                }
            },
            scales: {
                y: {
                    ticks: { color: '#e0e0e0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#e0e0e0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        };

        // Gráfica de ocupación por zonas
        this.charts.occupancy = new Chart(document.getElementById('occupancyChart'), {
            type: 'bar',
            data: {
                labels: this.zones,
                datasets: [{
                    label: 'Espacios Ocupados',
                    data: this.zones.map(() => 0),
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: commonOptions
        });

        // Gráfica de ingresos por zona
        this.charts.revenue = new Chart(document.getElementById('revenueChart'), {
            type: 'pie',
            data: {
                labels: this.zones,
                datasets: [{
                    data: Object.values(this.revenueByZone),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)',
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 206, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)',
                        'rgba(153, 102, 255, 0.6)'
                    ]
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#e0e0e0' }
                    }
                }
            }
        });

        // Gráfica de niveles de tráfico
        this.charts.traffic = new Chart(document.getElementById('trafficChart'), {
            type: 'bar',
            data: {
                labels: ['Bajo', 'Medio', 'Alto'],
                datasets: [{
                    label: 'Calles con Nivel de Tráfico',
                    data: [0, 0, 0],
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.6)',
                        'rgba(255, 206, 86, 0.6)',
                        'rgba(255, 99, 132, 0.6)'
                    ]
                }]
            },
            options: commonOptions
        });
    }

    initializeLayout() {
        const parkingMap = document.getElementById('parkingMap');
        let spotCounter = 1;

        // Crear puertas de entrada/salida
        const gates = [
            { position: 0, type: 'entrada', label: 'E1' },
            { position: 19, type: 'entrada', label: 'E2' },
            { position: 80, type: 'salida', label: 'S1' },
            { position: 99, type: 'salida', label: 'S2' }
        ];

        // Generar el diseño del estacionamiento
        for (let row = 0; row < 20; row++) {
            for (let col = 0; col < 20; col++) {
                const cell = document.createElement('div');
                const isStreet = this.isStreet(row, col);
                const gate = gates.find(g => g.position === (row * 20 + col));

                if (gate) {
                    cell.className = 'gate';
                    cell.textContent = gate.label;
                } else if (isStreet) {
                    cell.className = `street ${this.isHorizontalStreet(row) ? 'horizontal' : 'vertical'}`;
                } else {
                    const zone = this.getZone(row, col);
                    const isDisabled = Math.random() < 0.1; // 10% de espacios para discapacitados

                    const spot = document.createElement('div');
                    spot.className = `parking-spot zone-${zone.toLowerCase()}${isDisabled ? ' disabled' : ''}`;
                    spot.dataset.spotId = spotCounter;
                    spot.dataset.zone = zone;

                    const number = document.createElement('span');
                    number.className = 'spot-number';
                    number.textContent = spotCounter++;
                    spot.appendChild(number);

                    cell.appendChild(spot);
                    this.spots.push({
                        id: spotCounter - 1,
                        element: spot,
                        occupied: false,
                        zone: zone,
                        disabled: isDisabled,
                        position: { row, col }
                    });
                }

                parkingMap.appendChild(cell);
            }
        }

        this.updateZoneStats();
    }

    isStreet(row, col) {
        return row % 4 === 0 || col % 4 === 0;
    }

    isHorizontalStreet(row) {
        return row % 4 === 0;
    }

    getZone(row, col) {
        const zoneRow = Math.floor(row / 4);
        const zoneCol = Math.floor(col / 4);
        return this.zones[(zoneRow + zoneCol) % 5];
    }

    setupEventListeners() {
        setInterval(() => this.manageOccupancy(), 2000);
        setInterval(() => this.updateTraffic(), 3000);
        this.setupMaintenanceControls();
    }

    setupMaintenanceControls() {
        // Configurar controles para puertas
        const gateControls = document.getElementById('gateControls');
        ['E1', 'E2', 'S1', 'S2'].forEach(gate => {
            const toggle = this.createMaintenanceToggle(gate, 'gates');
            gateControls.appendChild(toggle);
        });

        // Configurar controles para calles
        const streetControls = document.getElementById('streetControls');
        ['Horizontal', 'Vertical'].forEach((direction, dirIndex) => {
            const count = direction === 'Horizontal' ? 5 : 4;
            for (let i = 0; i < count; i++) {
                const toggle = this.createMaintenanceToggle(
                    `${direction} ${i + 1}`,
                    'streets',
                    direction.toLowerCase(),
                    i
                );
                streetControls.appendChild(toggle);
            }
        });

        // Configurar controles para zonas
        const zoneControls = document.getElementById('zoneControls');
        this.zones.forEach(zone => {
            const toggle = this.createMaintenanceToggle(zone, 'zones');
            zoneControls.appendChild(toggle);
        });
    }

    createMaintenanceToggle(label, type, subType = null, index = null) {
        const div = document.createElement('div');
        div.className = 'maintenance-toggle';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `maintenance-${type}-${label}`;

        const labelElement = document.createElement('label');
        labelElement.htmlFor = checkbox.id;
        labelElement.textContent = label;

        checkbox.addEventListener('change', (e) => {
            if (subType) {
                this.maintenanceStatus[type][subType][index] = e.target.checked;
            } else {
                this.maintenanceStatus[type][label] = e.target.checked;
            }
            this.updateMaintenanceVisuals();
        });

        div.appendChild(checkbox);
        div.appendChild(labelElement);
        return div;
    }

    updateMaintenanceVisuals() {
        // Actualizar visuales de puertas
        Object.entries(this.maintenanceStatus.gates).forEach(([gate, status]) => {
            const gateElement = Array.from(document.getElementsByClassName('gate'))
                .find(el => el.textContent === gate);
            if (gateElement) {
                gateElement.classList.toggle('under-maintenance', status);
            }
        });

        // Actualizar visuales de calles
        const streets = document.getElementsByClassName('street');
        Array.from(streets).forEach(street => {
            const isHorizontal = street.classList.contains('horizontal');
            const index = isHorizontal ?
                Math.floor([...street.parentElement.children].indexOf(street) / 20) :
                Math.floor([...street.parentElement.children].indexOf(street) % 20 / 4);
            const status = isHorizontal ?
                this.maintenanceStatus.streets.horizontal[index] :
                this.maintenanceStatus.streets.vertical[index];
            street.classList.toggle('under-maintenance', status);
        });

        // Actualizar visuales de zonas y espacios
        this.spots.forEach(spot => {
            const zoneStatus = this.maintenanceStatus.zones[spot.zone];
            const spotStatus = this.maintenanceStatus.spots[spot.id] || false;
            spot.element.classList.toggle('under-maintenance', zoneStatus || spotStatus);
        });
    }

    generateTicket() {
        return {
            ticketNumber: this.ticketCounter++,
            entryTime: new Date(),
            entryGate: Math.random() < 0.5 ? 'E1' : 'E2'
        };
    }

    createCarElement(spot, ticket) {
        const car = document.createElement('div');
        car.className = 'car car-animation';
        car.style.backgroundColor = this.getRandomColor();

        const carInfo = document.createElement('div');
        carInfo.className = 'car-info';
        carInfo.innerHTML = `
            <h3>Ticket #${ticket.ticketNumber}</h3>
            <p>Entrada: ${ticket.entryGate}</p>
            <p>Zona: ${spot.zone}</p>
            <p>Espacio: ${spot.id}</p>
            <p>Fecha: ${ticket.entryTime.toLocaleDateString()}</p>
            <p>Hora: ${ticket.entryTime.toLocaleTimeString()}</p>
            <div class="qr-code" id="qr-${ticket.ticketNumber}"></div>
        `;

        car.appendChild(carInfo);
        spot.element.appendChild(car);

        const qrData = JSON.stringify({
            ticket: ticket.ticketNumber,
            entry: ticket.entryTime,
            gate: ticket.entryGate,
            spot: spot.id
        });
        new QRCode(document.getElementById(`qr-${ticket.ticketNumber}`), qrData);

        return car;
    }

    getRandomColor() {
        const colors = ['#4a90e2', '#50c878', '#ff7f50', '#da70d6', '#ffd700'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    findEmptySpot() {
        const availableSpots = this.spots.filter(spot => 
            !spot.occupied && 
            !this.maintenanceStatus.zones[spot.zone] && 
            !this.maintenanceStatus.spots[spot.id]
        );
        return availableSpots[Math.floor(Math.random() * availableSpots.length)];
    }

    manageOccupancy() {
        const currentOccupancy = this.cars.length / this.spots.length;
        const targetMin = this.targetOccupancyRange.min;
        const targetMax = this.targetOccupancyRange.max;

        if (currentOccupancy < targetMin) {
            // Agregar más autos si la ocupación está por debajo del mínimo
            const carsToAdd = Math.ceil((targetMin - currentOccupancy) * this.spots.length * 0.2);
            for (let i = 0; i < carsToAdd; i++) {
                this.simulateCarEntry();
            }
        } else if (currentOccupancy > targetMax) {
            // Remover autos si la ocupación está por encima del máximo
            const carsToRemove = Math.ceil((currentOccupancy - targetMax) * this.spots.length * 0.2);
            for (let i = 0; i < carsToRemove; i++) {
                this.simulateCarExit();
            }
        } else {
            // Mantener el dinamismo cuando estamos en el rango objetivo
            if (Math.random() < 0.5) {
                this.simulateCarEntry();
            } else {
                this.simulateCarExit();
            }
        }
    }

    simulateCarEntry() {
        // Verificar si hay entradas disponibles
        const availableEntries = ['E1', 'E2'].filter(gate => !this.maintenanceStatus.gates[gate]);
        if (availableEntries.length === 0) return;

        const emptySpot = this.findEmptySpot();
        if (emptySpot) {
            // Verificar si las calles necesarias están disponibles
            const spotRow = Math.floor(emptySpot.position.row / 4);
            const spotCol = Math.floor(emptySpot.position.col / 4);
            if (this.maintenanceStatus.streets.horizontal[spotRow] ||
                this.maintenanceStatus.streets.vertical[spotCol]) return;
            const ticket = this.generateTicket();
            const carElement = this.createCarElement(emptySpot, ticket);
            
            emptySpot.occupied = true;
            emptySpot.element.classList.add('occupied');
            
            // Actualizar ingresos
            this.totalRevenue += this.parkingRate;
            this.revenueByZone[emptySpot.zone] += this.parkingRate;
            
            this.cars.push({
                element: carElement,
                spot: emptySpot,
                ticket: ticket
            });

            this.updateStats();
            this.updateZoneStats();
            this.updateTrafficNearSpot(emptySpot.position);
        }
    }

    simulateCarExit() {
        if (this.cars.length > 0) {
            // Verificar si hay salidas disponibles
            const availableExits = ['S1', 'S2'].filter(gate => !this.maintenanceStatus.gates[gate]);
            if (availableExits.length === 0) return;

            const carIndex = Math.floor(Math.random() * this.cars.length);
            const car = this.cars[carIndex];

            // Verificar si las calles necesarias están disponibles
            const spotRow = Math.floor(car.spot.position.row / 4);
            const spotCol = Math.floor(car.spot.position.col / 4);
            if (this.maintenanceStatus.streets.horizontal[spotRow] ||
                this.maintenanceStatus.streets.vertical[spotCol]) return;
            
            car.spot.occupied = false;
            car.spot.element.classList.remove('occupied');
            car.element.remove();
            
            this.cars.splice(carIndex, 1);
            this.updateStats();
            this.updateZoneStats();
            this.updateTrafficNearSpot(car.spot.position);
        }
    }

    updateStats() {
        document.getElementById('availableSpots').textContent = this.spots.length - this.cars.length;
        document.getElementById('occupiedSpots').textContent = this.cars.length;
        document.getElementById('totalRevenue').textContent = this.totalRevenue.toFixed(2);

        // Actualizar gráfica de ocupación
        const occupancyData = this.zones.map(zone => {
            const zoneSpots = this.spots.filter(spot => spot.zone === zone);
            return zoneSpots.filter(spot => spot.occupied).length;
        });
        this.charts.occupancy.data.datasets[0].data = occupancyData;
        this.charts.occupancy.update();

        // Actualizar gráfica de ingresos
        this.charts.revenue.data.datasets[0].data = Object.values(this.revenueByZone);
        this.charts.revenue.update();
    }

    updateZoneStats() {
        const zoneStats = {};
        this.zones.forEach(zone => {
            const zoneSpots = this.spots.filter(spot => spot.zone === zone);
            const occupiedSpots = zoneSpots.filter(spot => spot.occupied).length;
            zoneStats[zone] = {
                total: zoneSpots.length,
                occupied: occupiedSpots,
                available: zoneSpots.length - occupiedSpots
            };
        });

        const zoneStatusElement = document.getElementById('zoneStatus');
        zoneStatusElement.innerHTML = this.zones.map(zone => `
            <div class="zone-stats zone-${zone.toLowerCase()}">
                <h3>Zona ${zone}</h3>
                <p>Ocupados: ${zoneStats[zone].occupied}</p>
                <p>Disponibles: ${zoneStats[zone].available}</p>
                <p>Ingresos: $${this.revenueByZone[zone].toFixed(2)}</p>
            </div>
        `).join('');
    }

    updateTraffic() {
        for (let i = 0; i < this.trafficLevels.horizontal.length; i++) {
            this.trafficLevels.horizontal[i] = this.getRandomTrafficLevel();
        }
        for (let i = 0; i < this.trafficLevels.vertical.length; i++) {
            this.trafficLevels.vertical[i] = this.getRandomTrafficLevel();
        }

        const streets = document.querySelectorAll('.street');
        streets.forEach(street => {
            street.classList.remove('traffic-low', 'traffic-medium', 'traffic-high');
            const isHorizontal = street.classList.contains('horizontal');
            const index = isHorizontal ? 
                Math.floor([...street.parentElement.children].indexOf(street) / 20) :
                Math.floor([...street.parentElement.children].indexOf(street) % 20 / 4);
            const level = isHorizontal ? 
                this.trafficLevels.horizontal[index] : 
                this.trafficLevels.vertical[index];
            street.classList.add(`traffic-${level}`);
        });

        this.updateTrafficStats();
    }

    getRandomTrafficLevel() {
        const levels = ['low', 'medium', 'high'];
        return levels[Math.floor(Math.random() * levels.length)];
    }

    updateTrafficStats() {
        const trafficStatusElement = document.getElementById('trafficStatus');
        trafficStatusElement.innerHTML = `
            <div class="traffic-info">
                <p>Calles horizontales con tráfico alto: 
                    ${this.trafficLevels.horizontal.filter(level => level === 'high').length}</p>
                <p>Calles verticales con tráfico alto: 
                    ${this.trafficLevels.vertical.filter(level => level === 'high').length}</p>
            </div>
        `;

        // Actualizar gráfica de tráfico
        const allLevels = [...this.trafficLevels.horizontal, ...this.trafficLevels.vertical];
        const trafficData = [
            allLevels.filter(level => level === 'low').length,
            allLevels.filter(level => level === 'medium').length,
            allLevels.filter(level => level === 'high').length
        ];
        this.charts.traffic.data.datasets[0].data = trafficData;
        this.charts.traffic.update();
    }

    updateTrafficNearSpot(position) {
        const horizontalStreetIndex = Math.floor(position.row / 4);
        const verticalStreetIndex = Math.floor(position.col / 4);
        
        if (horizontalStreetIndex < this.trafficLevels.horizontal.length) {
            this.trafficLevels.horizontal[horizontalStreetIndex] = 
                this.getTrafficLevelBasedOnDensity(horizontalStreetIndex, true);
        }
        
        if (verticalStreetIndex < this.trafficLevels.vertical.length) {
            this.trafficLevels.vertical[verticalStreetIndex] = 
                this.getTrafficLevelBasedOnDensity(verticalStreetIndex, false);
        }
    }

    getTrafficLevelBasedOnDensity(index, isHorizontal) {
        const nearbySpots = this.spots.filter(spot => {
            if (isHorizontal) {
                return Math.floor(spot.position.row / 4) === index;
            } else {
                return Math.floor(spot.position.col / 4) === index;
            }
        });

        const occupiedRatio = nearbySpots.filter(spot => spot.occupied).length / nearbySpots.length;

        if (occupiedRatio > 0.7) return 'high';
        if (occupiedRatio > 0.4) return 'medium';
        return 'low';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const parkingSystem = new ParkingSystem();
    parkingSystem.initializeCharts();
});