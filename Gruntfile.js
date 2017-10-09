module.exports = (grunt) => {
    require('load-grunt-tasks')(grunt);

    grunt.loadNpmTasks('grunt-execute');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-service');
    grunt.loadNpmTasks('grunt-multi-dest');

    grunt.initConfig({

        clean: ['dist'],

        copy: {
            main: {
                cwd: 'src',
                expand: true,
                src: ['**/*', '!**/*.js', '!**/*.scss', '!img/**/*'],
                dest: 'dist'
            },
            pluginDef: {
                expand: true,
                src: ['plugin.json', 'README.md'],
                dest: 'dist',
            },
            img_to_dist: {
                cwd: 'src',
                expand: true,
                src: ['img/**/*'],
                dest: 'dist/src/'
            },
            images_to_dist: {
                cwd: 'src',
                expand: true,
                src: ['images/**/*'],
                dest: 'dist/src/'
            },
            bower_libs: {
                cwd: 'bower_components',
                expand: true,
                src: ['d3'],
                dest: 'dist/libs/'
            },
            externals: {
                cwd: 'src',
                expand: true,
                src: ['**/external/*'],
                dest: 'dist'

            },
        },

        multidest: {
            copy_some_files: {
                tasks: [
                    "copy:main",
                    'copy:img_to_dist',
                    "copy:externals",
                    "copy:pluginDef"
                ],
                dest: ["dist"]
            },
        },

        watch: {
            rebuild_all: {
                files: ['src/**/*', 'plugin.json'],
                tasks: ['default', 'service:restart'],
                options: {
                    spawn: false,
                    interrupt: true
                }
            },
        },

        service: {
            restart: {
                shellCommand: 'sudo service grafana-server restart'
            },
        },

        babel: {
            options: {
                ignore: ['**/bower_components/*','**/external/*'],
                sourceMap: true,
                presets: ['es2015'],
                //plugins: ['transform-es2015-modules-systemjs', 'transform-es2015-for-of'],
                plugins: ['transform-es2015-modules-systemjs', 'transform-es2015-for-of'],
            },
            dist: {
                files: [{
                    cwd: 'src',
                    expand: true,
                    src: ['*.js'],
                    dest: 'dist',
                    ext: '.js',
                    excludes: ["leaflet.js", "d3-min.js"]
                }]
            },
        },

    });

    grunt.registerTask('default',
        [
            'clean',
            'multidest',
            'copy:bower_libs',
            'babel',
            'service:restart'
        ]);

};
