import { Component, Input, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';

import { NetworkService } from '../../services/network.service';
import { Student } from '../../models/student/student';
import { Subject } from '../../models/subject/subject';
import d3 from 'd3';

@Component({
  selector: 'app-network',
  templateUrl: './network.component.html',
  styleUrls: ['./network.component.css']
})
export class NetworkComponent implements AfterViewInit {
  @Input() student: Student;
  @Input() subjects: Subject[];
  simulation: any;
  dataset: any;

  constructor(private networkService: NetworkService) { }

  ngAfterViewInit() {
    this.generateGraph();
  }

  generateGraph() {
    this.networkService.set(this.student, this.subjects);
    const dataset = this.networkService.getDataSet();

    const numberOfQuarters = dataset.numberOfQuarters;
    const maxNodesQuarter = dataset.maxNodesQuarter;

    const margin = { top: 50, right: 100, bottom: 50, left: 100 };
    const wrapperWidth = 1200;
    const wrapperHeight = 600;
    const width = wrapperWidth - margin.left - margin.right;
    const height = wrapperHeight - margin.top - margin.bottom;

    const refWidth = 150;
    const radius = 15;
    const fill = d3.scaleOrdinal(d3.schemeCategory10);

    const x = d3.scaleLinear()
      .domain([1, numberOfQuarters])
      .range([margin.left, margin.right + width]);

    const y = d3.scaleLinear()
      .domain([0, maxNodesQuarter])
      .range([margin.top + height, margin.bottom]);

    const xAxis = d3.axisBottom(x).ticks(numberOfQuarters);

    const zoom = d3.zoom()
      .on('zoom', zoomed)
      .scaleExtent([0.25, 3])
      ;

    const wrapper = d3.select('#wrapper');

    const graphSVG = d3.select('#graph')
      .classed('svg-container', true)
      .append('svg')
      .attr('width', wrapperWidth)
      .attr('height', wrapperHeight)
      .classed('svg-content-responsive', true);

    const svg = graphSVG.append('g');

    svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(0,${margin.top + height})`)
      .call(xAxis);

    const simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id((d) => d.id))
      .force('xPos', d3.forceX((d) => x(d.xPos)).strength(5))
      .force('yPos', d3.forceY((d) => {
        const partitions = numberOfQuarters / d.nodesPerQuarter;
        return y(partitions + d.yPos);
      }).strength(5));

    simulation
      .nodes(dataset.nodes)
      .on('tick', ticked);

    simulation.force('link')
      .strength(0)
      .links(dataset.links);

    const link = svg.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(dataset.links)
      .enter().append('line')
      .on('mouseout', fade(1))
      ;

    const node = svg.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(dataset.nodes)
      .enter().append('g')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    const borderCircles = node.append('circle')
      .attr('r', radius)
      .attr('fill', (d) => fill(d.group))
      .attr('class', (d) => d.state || null)
      .classed('state', this.student)
      .classed('quarter', !this.student)
      ;

    const circles = node.append('circle')
      .attr('r', radius - 6)
      .attr('class', 'group')
      .attr('fill', (d) => fill(d.group))
      .on('mouseover', fade(0.1))
      .on('mouseout', fade(1))
      ;

    const labels = node.append('text')
      .attr('class', 'label')
      .attr('dx', 0)
      .attr('dy', radius * 2)
      .text((d) => d.name);

    const references = d3.select('#references')
      .append('svg')
      .attr('width', refWidth)
      .attr('height', '100%')
      .append('g')
      .attr('class', 'refWrapper');

    const titleRef = references.append('g')
      .attr('class', 'titleRef')
      .append('text')
      .text('Referencias:')
      .attr('x', 0)
      .attr('y', 9)
      .style('text-anchor', 'start')
      .style('font-weight', 'bold')
      .style('font-size', '10px');

    const legend = references.selectAll('.legend')
      .data(fill.domain())
      .enter().append('g')
      .attr('class', 'legend')
      .attr('transform', (d, i) => `translate(0, ${(i * 20) + 20})`);

    legend.append('rect')
      .attr('width', 15)
      .attr('height', 10)
      .style('fill', fill);

    legend.append('text')
      .attr('x', 26)
      .attr('y', 7.5)
      .style('text-anchor', 'start')
      .style('font-size', '9px')
      .text((d) => `${d}° año`);

    // TODO: don't repeat code
    let target = wrapper.node().getBoundingClientRect();
    let container = svg.node().getBoundingClientRect();
    let currentScale = target.width / wrapperWidth;
    let centerYPos = 0;

    graphSVG.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.scale(currentScale));

    target = wrapper.node().getBoundingClientRect();
    container = svg.node().getBoundingClientRect();
    currentScale = target.width / wrapperWidth;
    centerYPos = target.height > container.height ? ((target.height / 2) - (container.height / 2)) / currentScale : 0;

    svg.call(zoom.transform, d3.zoomIdentity
      .scale(currentScale)
      .translate(0, centerYPos))
      ;
    //

    d3.select(window)
      .on('resize', function () {
        target = wrapper.node().getBoundingClientRect();
        container = svg.node().getBoundingClientRect();
        currentScale = target.width / wrapperWidth;
        centerYPos = target.height > container.height ? ((target.height / 2) - (container.height / 2)) / currentScale : 0;
        svg.call(zoom.transform, d3.zoomIdentity
          .scale(currentScale)
          .translate(0, centerYPos))
          ;
      });

    function zoomed() {
      svg.attr('transform', d3.event.transform); // updated for d3 v4
    }

    function ticked() {
      node.attr('transform', (d) => {
        return `translate(${d.x}, ${d.y})`;
      });

      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);
    }

    function dragstarted(d) {
      if (!d3.event.active) {
        simulation.alphaTarget(0.3).restart();
      }
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(d) {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }

    function dragended(d) {
      if (!d3.event.active) {
        simulation.alphaTarget(0);
      }
      d.fx = null;
      d.fy = null;
    }

    const linkedByIndex = {};
    dataset.links.forEach(d => {
      linkedByIndex[`${d.source.index},${d.target.index}`] = 1;
    });

    function isConnected(a, b) {
      return linkedByIndex[`${a.index},${b.index}`] || linkedByIndex[`${b.index},${a.index}`] || a.index === b.index;
    }

    function fade(opacity) {
      return d => {
        node.style('opacity', function (o) {
          const thisOpacity = isConnected(d, o) ? 1 : opacity;
          return thisOpacity;
        });

        link.style('opacity', o => (o.source === d || o.target === d ? 1 : opacity));
      };
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['student'] && !changes['student'].isFirstChange()) || (changes['subjects'] && !changes['subjects'].isFirstChange())) {
      d3.select('#graph').selectAll('*').remove();
      d3.select('#references').selectAll('*').remove();
      this.generateGraph();
    }
  }
}
